//! Realtime system specifications backing the `GET /api/system` endpoint.
//!
//! All metrics are read live from the Linux proc filesystem so the Settings
//! "System Architecture" card can display true realtime numbers:
//! - RSS memory from `/proc/self/status` (VmRSS)
//! - CPU time from `/proc/self/stat` (utime + stime, sampled per request)
//! - process uptime from an `Instant` captured at startup
//! - a request counter bumped by the Axum request-counting middleware
//! - cron bookkeeping: next 10:00 UTC trigger + last run timestamp

use chrono::{DateTime, NaiveTime, TimeZone, Utc};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Instant, SystemTime};

use crate::database::Database;

static START: OnceLock<Instant> = OnceLock::new();
static REQUESTS: AtomicU64 = AtomicU64::new(0);
static LAST_CRON_EPOCH: Mutex<Option<i64>> = Mutex::new(None);
static CPU_PREV: Mutex<Option<(u64, Instant)>> = Mutex::new(None);

/// Record the process start instant. Called once at server startup.
pub fn init() {
    let _ = START.set(Instant::now());
}

pub fn bump_requests() {
    REQUESTS.fetch_add(1, Ordering::Relaxed);
}

pub fn mark_cron_run() {
    let now = epoch_now();
    if let Ok(mut slot) = LAST_CRON_EPOCH.lock() {
        *slot = Some(now);
    }
}

fn epoch_now() -> i64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Current resident set size in kilobytes from /proc/self/status (0 when unavailable).
fn rss_kb() -> u64 {
    if let Ok(status) = std::fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if let Some(rest) = line.strip_prefix("VmRSS:") {
                // Line format: "VmRSS:\t   12345 kB" — first whitespace-split
                // token is the number, "kB" follows.
                let num = rest.split_whitespace().next().unwrap_or("");
                return num.parse().unwrap_or(0);
            }
        }
    }
    0
}

/// Cumulative process CPU time in clock ticks from /proc/self/stat.
///
/// The `comm` field (field 2) can contain spaces, so parse after the last ')'.
fn cpu_ticks() -> u64 {
    if let Ok(stat) = std::fs::read_to_string("/proc/self/stat") {
        if let Some(idx) = stat.rfind(')') {
            let fields: Vec<&str> = stat[idx + 1..].split_whitespace().collect();
            // fields[0] is `state` (field 3); utime (field 14) -> index 11,
            // stime (field 15) -> index 12.
            let utime: u64 = fields.get(11).and_then(|s| s.parse().ok()).unwrap_or(0);
            let stime: u64 = fields.get(12).and_then(|s| s.parse().ok()).unwrap_or(0);
            return utime + stime;
        }
    }
    0
}

/// Process CPU usage percentage computed from the delta since the previous
/// sample. The frontend polls /api/system every ~2s, giving a good window.
fn cpu_percent() -> f64 {
    const CLK_TCK: f64 = 100.0; // typical _SC_CLK_TCK on Linux
    let ticks = cpu_ticks();
    let now = Instant::now();

    let mut prev = match CPU_PREV.lock() {
        Ok(p) => p,
        Err(_) => return 0.0,
    };

    let pct = match *prev {
        Some((pticks, pat)) => {
            let dt = now.duration_since(pat).as_secs_f64();
            if dt >= 0.05 {
                ((ticks.saturating_sub(pticks) as f64) / CLK_TCK / dt) * 100.0
            } else {
                // Window too small — keep sampling without reporting garbage.
                return 0.0;
            }
        }
        None => 0.0,
    };
    *prev = Some((ticks, now));
    pct.clamp(0.0, 100.0)
}

fn uptime_secs() -> u64 {
    START.get().map(|s| s.elapsed().as_secs()).unwrap_or(0)
}

/// The next 10:00:00 UTC from now (the daily auto-solve trigger).
fn next_cron_utc() -> DateTime<Utc> {
    let now = Utc::now();
    let trigger_time = NaiveTime::from_hms_opt(10, 0, 0).unwrap_or_default();
    let today = now.date_naive().and_time(trigger_time);
    let today_utc = Utc.from_utc_datetime(&today);
    if now >= today_utc {
        let tomorrow = (now.date_naive() + chrono::Duration::days(1)).and_time(trigger_time);
        Utc.from_utc_datetime(&tomorrow)
    } else {
        today_utc
    }
}

/// Build the full realtime system snapshot consumed by the Settings monitor.
pub fn snapshot(db: &Database) -> serde_json::Value {
    let rss_mb = (rss_kb() as f64 / 1024.0 * 10.0).round() / 10.0;
    let next = next_cron_utc();
    let next_in = (next - Utc::now()).num_seconds().max(0);
    let last_cron: Option<String> = match LAST_CRON_EPOCH.lock() {
        Ok(slot) => slot.map(|e| {
            Utc.timestamp_opt(e, 0)
                .single()
                .map(|d| d.to_rfc3339())
                .unwrap_or_default()
        }),
        Err(_) => None,
    };
    let stats = db.get_stats().ok();

    json!({
        "runtime": "Rust + Axum 0.7",
        "version": env!("CARGO_PKG_VERSION"),
        "profile": if cfg!(debug_assertions) { "debug" } else { "release" },
        "arch": std::env::consts::ARCH,
        "os": std::env::consts::OS,
        "pid": std::process::id(),
        // Live process metrics
        "memory_rss_mb": rss_mb,
        "memory_budget_mb": 512.0,
        "memory_budget_label": "Render Free Tier (512 MB)",
        "memory_target_mb": 15.0,
        "memory_target_label": "app target < 15 MB",
        "cpu_percent": cpu_percent(),
        "uptime_secs": uptime_secs(),
        "requests_served": REQUESTS.load(Ordering::Relaxed),
        // Cron
        "cron_schedule": "0 0 10 * * *",
        "cron_trigger": "10:00 AM UTC",
        "cron_scheduler": "tokio-cron-scheduler",
        "cron_next_run_iso": next.to_rfc3339(),
        "cron_next_run_in_secs": next_in,
        "cron_last_run_iso": last_cron,
        // Repository
        "repo": "doocs/leetcode",
        "repo_problems": "3,500+",
        // Database
        "submissions_total": stats.as_ref().map(|s| s.total).unwrap_or(0),
        "submissions_accepted": stats.as_ref().map(|s| s.accepted).unwrap_or(0),
        "success_rate": stats.as_ref().map(|s| s.success_rate).unwrap_or(0.0),
        "timestamp": Utc::now().to_rfc3339(),
    })
}
