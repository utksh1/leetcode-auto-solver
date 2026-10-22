mod config;
mod database;
mod handlers;
mod leetcode;
mod solution;
mod system;

use axum::{
    middleware::Next,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};
use tower_http::services::ServeDir;

use crate::config::AppConfig;
use crate::database::{Database, SubmissionRecord};
use crate::handlers::{
    get_daily_handler, get_history_handler, get_problem_handler, get_session_status_handler,
    get_stats_handler, get_system_handler, health_handler, preview_solution_handler,
    save_session_handler, search_problems_handler, solve_handler, test_solution_handler, AppState,
};
use crate::leetcode::LeetCodeClient;
use crate::solution::SolutionFetcher;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Record process start for the realtime /api/system uptime metric
    system::init();

    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug".into()),
        )
        .init();

    let config = AppConfig::load();
    let args: Vec<String> = std::env::args().collect();

    // Initialize Database
    let db = Database::new(&config.db_path)
        .expect("Failed to initialize SQLite database");

    let leetcode = Arc::new(LeetCodeClient::new());
    let solution_fetcher = Arc::new(SolutionFetcher::new());

    // Check CLI mode: e.g. `cargo run -- solve [optional_slug] [optional_lang]`
    if args.len() > 1 && args[1] == "solve" {
        let slug = args.get(2).cloned();
        let lang = args.get(3).cloned().unwrap_or(config.preferred_lang.clone());

        println!("⚡ Running LeetCode Auto-Solver in CLI mode...");
        let start_time = std::time::Instant::now();
        let today_date = chrono::Utc::now().format("%Y-%m-%d").to_string();

        let problem = if let Some(ref s) = slug {
            println!("🔍 Fetching problem details for '{}'...", s);
            leetcode.fetch_problem_by_slug_or_id(s).await?
        } else {
            println!("📥 Fetching today's daily problem from LeetCode GraphQL...");
            leetcode.fetch_daily_problem().await?
        };

        println!("📝 Problem: #{} {} [{}]", problem.question_frontend_id, problem.title, problem.difficulty);

        println!("🔎 Searching GitHub for solutions (language: {})...", lang);
        let solution = solution_fetcher.fetch_solution(
            &problem.question_frontend_id,
            &problem.title,
            &problem.title_slug,
            &lang,
        ).await?;

        println!("✅ Solution retrieved from: {}", solution.source);
        println!("--------------------------------------------------");
        println!("{}", solution.code);
        println!("--------------------------------------------------");

        let (status, sub_id, runtime, memory, err_msg) = match (&config.leetcode_session, &config.csrf_token) {
            (Some(session), Some(csrf)) if !session.is_empty() && !csrf.is_empty() => {
                println!("📤 Submitting solution to LeetCode...");
                match leetcode.submit_solution(
                    session,
                    csrf,
                    &problem.title_slug,
                    &problem.question_id,
                    &solution.language,
                    &solution.code,
                ).await {
                    Ok(res) => (res.status, Some(res.submission_id), res.runtime, res.memory, res.compile_error),
                    Err(e) => ("Submission Error".to_string(), None, None, None, Some(e)),
                }
            }
            _ => {
                println!("ℹ️  No LeetCode session token provided. Verified locally.");
                ("Simulated (No Session)".to_string(), None, None, None, Some("Session not configured".to_string()))
            }
        };

        let exec_ms = start_time.elapsed().as_millis() as i64;
        let record = SubmissionRecord {
            id: None,
            date: today_date,
            problem_id: Some(problem.question_frontend_id),
            problem_title: Some(problem.title),
            difficulty: Some(problem.difficulty),
            status: status.clone(),
            submission_id: sub_id,
            runtime,
            memory,
            execution_time: exec_ms,
            language: Some(solution.language),
            code: Some(solution.code),
            error: err_msg,
            created_at: None,
        };

        db.save_submission(&record)?;
        println!("🎉 Status: {} (Execution: {}ms)", status, exec_ms);
        return Ok(());
    }

    let port = config.port;
    let config_arc = Arc::new(RwLock::new(config));

    let state = AppState {
        db: db.clone(),
        leetcode: leetcode.clone(),
        solution_fetcher: solution_fetcher.clone(),
        config: config_arc.clone(),
    };

    // Background Cron Scheduler (Daily problem auto-solving)
    let sched_state = state.clone();
    tokio::spawn(async move {
        if let Ok(sched) = JobScheduler::new().await {
            let job_state = sched_state.clone();
            // Schedule job daily at 10:00:00 UTC
            let job = Job::new_async("0 0 10 * * *", move |_uuid, _lock| {
                let st = job_state.clone();
                Box::pin(async move {
                    println!("🕐 [CRON] Starting scheduled daily problem solver run...");
                    system::mark_cron_run();
                    let start_time = std::time::Instant::now();
                    let today_date = chrono::Utc::now().format("%Y-%m-%d").to_string();

                    match st.leetcode.fetch_daily_problem().await {
                        Ok(problem) => {
                            let cfg = st.config.read().await.clone();
                            let lang = cfg.preferred_lang.clone();
                            match st.solution_fetcher.fetch_solution(
                                &problem.question_frontend_id,
                                &problem.title,
                                &problem.title_slug,
                                &lang,
                            ).await {
                                Ok(solution) => {
                                    let (status, sub_id, runtime, memory, err) = match (&cfg.leetcode_session, &cfg.csrf_token) {
                                        (Some(sess), Some(csrf)) if !sess.is_empty() && !csrf.is_empty() => {
                                            match st.leetcode.submit_solution(
                                                sess,
                                                csrf,
                                                &problem.title_slug,
                                                &problem.question_id,
                                                &solution.language,
                                                &solution.code,
                                            ).await {
                                                Ok(res) => (res.status, Some(res.submission_id), res.runtime, res.memory, res.compile_error),
                                                Err(e) => ("Submission Error".to_string(), None, None, None, Some(e)),
                                            }
                                        }
                                        _ => ("Simulated (No Session)".to_string(), None, None, None, Some("Session not configured".to_string())),
                                    };

                                    let exec_ms = start_time.elapsed().as_millis() as i64;
                                    let _ = st.db.save_submission(&SubmissionRecord {
                                        id: None,
                                        date: today_date,
                                        problem_id: Some(problem.question_frontend_id),
                                        problem_title: Some(problem.title),
                                        difficulty: Some(problem.difficulty),
                                        status,
                                        submission_id: sub_id,
                                        runtime,
                                        memory,
                                        execution_time: exec_ms,
                                        language: Some(solution.language),
                                        code: Some(solution.code),
                                        error: err,
                                        created_at: None,
                                    });
                                }
                                Err(e) => eprintln!("❌ [CRON] Failed to fetch solution: {}", e),
                            }
                        }
                        Err(e) => eprintln!("❌ [CRON] Failed to fetch daily problem: {}", e),
                    }
                })
            });

            if let Ok(j) = job {
                let _ = sched.add(j).await;
                let _ = sched.start().await;
                println!("⏰ Background Cron Job scheduled (Daily at 10:00 AM UTC)");
            }
        }
    });

    // Build Router
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/api/stats", get(get_stats_handler))
        .route("/api/history", get(get_history_handler))
        .route("/api/daily", get(get_daily_handler))
        .route("/api/search", get(search_problems_handler))
        .route("/api/problem/:slug", get(get_problem_handler))
        .route("/api/preview/:slug", get(preview_solution_handler))
        .route("/api/test", post(test_solution_handler))
        .route("/api/solve", post(solve_handler))
        .route("/api/session/status", get(get_session_status_handler))
        .route("/api/session", post(save_session_handler))
        .route("/api/system", get(get_system_handler))
        .route("/favicon.svg", get(static_root_file_handler))
        .route("/icons.svg", get(static_root_file_handler))
        .nest_service("/assets", ServeDir::new("public/assets"))
        .fallback(spa_fallback)
        .layer(axum::middleware::from_fn(count_requests))
        .layer(axum::middleware::from_fn(no_store_api))
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🚀 Rust LeetCode Auto-Solver server running on http://localhost:{}", port);
    println!("📊 Dashboard: http://localhost:{}", port);
    println!("⚡ Health: http://localhost:{}/health", port);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Request-counting middleware feeding the realtime "Requests Served" metric.
async fn count_requests(
    req: axum::extract::Request,
    next: Next,
) -> axum::response::Response {
    system::bump_requests();
    next.run(req).await
}

/// Mark every API/health response as uncacheable. /api/history returns full
/// submitted source code and /api/session/status returns the account name —
/// those must never land in browser caches, proxies, or back/forward caches.
/// 
/// Note: the previous `CorsLayer::permissive()` was deliberately removed.
/// The SPA is served same-origin (and the Vite dev server proxies /api), so
/// CORS is never needed — while a permissive policy would let any website
/// read this API (including submission history) from a visitor's browser.
async fn no_store_api(
    req: axum::extract::Request,
    next: Next,
) -> axum::response::Response {
    let path = req.uri().path().to_owned();
    let mut res = next.run(req).await;
    if path.starts_with("/api") || path.starts_with("/health") {
        res.headers_mut().insert(
            axum::http::header::CACHE_CONTROL,
            axum::http::HeaderValue::from_static("no-store"),
        );
    }
    res
}

async fn spa_fallback() -> (axum::http::StatusCode, axum::response::Html<String>) {
    match tokio::fs::read_to_string("public/index.html").await {
        Ok(html) => (axum::http::StatusCode::OK, axum::response::Html(html)),
        Err(_) => (
            axum::http::StatusCode::NOT_FOUND,
            axum::response::Html("<h1>Index file not found</h1>".to_string()),
        ),
    }
}

/// Serve root-level static files (favicon.svg, icons.svg) with correct MIME type.
/// Without this, requests fell through to the SPA HTML fallback and the browser
/// could not render the tab icon.
async fn static_root_file_handler(req: axum::extract::Request) -> impl IntoResponse {
    let name = req.uri().path().trim_start_matches('/');
    let file_path = match name {
        "favicon.svg" => "public/favicon.svg",
        "icons.svg" => "public/icons.svg",
        _ => return axum::http::StatusCode::NOT_FOUND.into_response(),
    };
    serve_public_file(file_path).await
}

async fn serve_public_file(path: &str) -> axum::response::Response {
    match tokio::fs::read(path).await {
        Ok(bytes) => (
            [(axum::http::header::CONTENT_TYPE, "image/svg+xml")],
            bytes,
        )
            .into_response(),
        Err(_) => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}
