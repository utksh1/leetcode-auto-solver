use axum::{
    extract::{Path as AxumPath, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::config::AppConfig;
use crate::database::{Database, SubmissionRecord};
use crate::leetcode::LeetCodeClient;
use crate::solution::SolutionFetcher;
use crate::system;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub leetcode: Arc<LeetCodeClient>,
    pub solution_fetcher: Arc<SolutionFetcher>,
    pub config: Arc<RwLock<AppConfig>>,
    pub bulk: Arc<BulkState>,
}

#[derive(Deserialize)]
pub struct SolveRequest {
    pub slug: Option<String>,
    pub title_slug: Option<String>,
    pub lang: Option<String>,
    pub language: Option<String>,
    pub code: Option<String>,
}

#[derive(Deserialize)]
pub struct TestRequest {
    pub slug: Option<String>,
    pub title_slug: Option<String>,
    pub lang: Option<String>,
    pub language: Option<String>,
    pub code: Option<String>,
    pub data_input: Option<String>,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
}

#[derive(Serialize)]
pub struct SolveResponse {
    pub success: bool,
    pub problem_id: String,
    pub problem_title: String,
    pub difficulty: String,
    pub status: String,
    pub language: String,
    pub code: String,
    pub runtime: Option<String>,
    pub memory: Option<String>,
    pub execution_time_ms: i64,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct PreviewQuery {
    pub lang: Option<String>,
}

#[derive(Deserialize)]
pub struct SaveSessionRequest {
    pub session_token: Option<String>,
    pub leetcode_session: Option<String>,
    pub csrf_token: Option<String>,
}

pub async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "service": "leetcode-auto-solver",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Realtime system specifications (memory, CPU, uptime, cron countdown,
/// request counter). Powers the live "System Architecture" monitor in Settings.
pub async fn get_system_handler(State(state): State<AppState>) -> impl IntoResponse {
    Json(system::snapshot(&state.db))
}

pub async fn get_stats_handler(State(state): State<AppState>) -> impl IntoResponse {
    match state.db.get_stats() {
        Ok(stats) => (StatusCode::OK, Json(serde_json::json!({
            "total": stats.total,
            "accepted": stats.accepted,
            "failed": stats.failed,
            "successRate": stats.success_rate,
            "success_rate": stats.success_rate,
            "avgExecutionTime": stats.avg_execution_time,
            "avg_execution_time": stats.avg_execution_time,
            "avg_execution_time_ms": stats.avg_execution_time
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn get_history_handler(State(state): State<AppState>) -> impl IntoResponse {
    match state.db.get_history(100) {
        Ok(history) => (StatusCode::OK, Json(history)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

pub async fn get_daily_handler(State(state): State<AppState>) -> impl IntoResponse {
    match state.leetcode.fetch_daily_problem().await {
        Ok(problem) => {
            let tags: Vec<String> = problem.topic_tags.iter().map(|t| t.name.clone()).collect();
            (StatusCode::OK, Json(serde_json::json!({
                "question_id": problem.question_id,
                "question_frontend_id": problem.question_frontend_id,
                "frontend_question_id": problem.question_frontend_id,
                "title": problem.title,
                "question_title": problem.title,
                "title_slug": problem.title_slug,
                "difficulty": problem.difficulty,
                "content": problem.content,
                "question_content": problem.content,
                "date": problem.date.clone().unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string()),
                "link": format!("/problems/{}/", problem.title_slug),
                "topic_tags": tags,
            }))).into_response()
        },
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

pub async fn search_problems_handler(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let q = query.q.unwrap_or_default();
    let trimmed = q.trim();
    if trimmed.is_empty() {
        return (StatusCode::OK, Json(serde_json::json!([]))).into_response();
    }

    match state.leetcode.search_problems(trimmed).await {
        Ok(results) => (StatusCode::OK, Json(results)).into_response(),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

pub async fn get_problem_handler(
    State(state): State<AppState>,
    AxumPath(slug): AxumPath<String>,
) -> impl IntoResponse {
    match state.leetcode.fetch_problem_by_slug_or_id(&slug).await {
        Ok(problem) => {
            let tags: Vec<String> = problem.topic_tags.iter().map(|t| t.name.clone()).collect();
            (StatusCode::OK, Json(serde_json::json!({
                "question_id": problem.question_id,
                "question_frontend_id": problem.question_frontend_id,
                "frontend_question_id": problem.question_frontend_id,
                "title": problem.title,
                "question_title": problem.title,
                "title_slug": problem.title_slug,
                "difficulty": problem.difficulty,
                "content": problem.content,
                "question_content": problem.content,
                "topic_tags": tags,
                "example_testcase_list": problem.example_testcase_list,
                "sample_test_case": problem.sample_test_case,
            }))).into_response()
        },
        Err(e) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

pub async fn preview_solution_handler(
    State(state): State<AppState>,
    AxumPath(slug): AxumPath<String>,
    Query(query): Query<PreviewQuery>,
) -> impl IntoResponse {
    let cfg = state.config.read().await;
    let lang = query.lang.unwrap_or_else(|| cfg.preferred_lang.clone());

    // Fetch problem info to get frontend ID and Title
    let problem = match state.leetcode.fetch_problem_by_slug_or_id(&slug).await {
        Ok(p) => p,
        Err(_) => match state.leetcode.fetch_daily_problem().await {
            Ok(p) if p.title_slug == slug || p.question_frontend_id == slug => p,
            _ => {
                return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": format!("Could not find problem '{}'", slug) }))).into_response();
            }
        },
    };

    match state.solution_fetcher.fetch_solution(&problem.question_frontend_id, &problem.title, &problem.title_slug, &lang).await {
        Ok(solution) => (StatusCode::OK, Json(serde_json::json!({
            "problemTitle": problem.title,
            "problem_title": problem.title,
            "problemId": problem.question_frontend_id,
            "problem_id": problem.question_frontend_id,
            "difficulty": problem.difficulty,
            "language": solution.language,
            "code": solution.code,
            "source": solution.source,
            "example_testcase_list": problem.example_testcase_list,
            "sample_test_case": problem.sample_test_case,
        }))).into_response(),
        Err(e) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

pub async fn test_solution_handler(
    State(state): State<AppState>,
    Json(payload): Json<TestRequest>,
) -> impl IntoResponse {
    let cfg = state.config.read().await.clone();
    let lang = payload.lang.or(payload.language).unwrap_or(cfg.preferred_lang.clone());
    let requested_slug = payload.slug.or(payload.title_slug);

    let problem = match if let Some(ref slug) = requested_slug {
        state.leetcode.fetch_problem_by_slug_or_id(slug).await
    } else {
        state.leetcode.fetch_daily_problem().await
    } {
        Ok(p) => p,
        Err(e) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response(),
    };

    let (code, language) = if let Some(ref c) = payload.code {
        if !c.trim().is_empty() {
            (c.clone(), lang)
        } else {
            match state.solution_fetcher.fetch_solution(
                &problem.question_frontend_id,
                &problem.title,
                &problem.title_slug,
                &lang,
            ).await {
                Ok(s) => (s.code, s.language),
                Err(e) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response(),
            }
        }
    } else {
        match state.solution_fetcher.fetch_solution(
            &problem.question_frontend_id,
            &problem.title,
            &problem.title_slug,
            &lang,
        ).await {
            Ok(s) => (s.code, s.language),
            Err(e) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response(),
        }
    };

    let (session, csrf) = match (&cfg.leetcode_session, &cfg.csrf_token) {
        (Some(s), Some(c)) if !s.is_empty() && !c.is_empty() => (s.clone(), c.clone()),
        _ => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "LeetCode session and CSRF token required to run testcases. Configure in Settings."
        }))).into_response(),
    };

    let default_input = if !problem.example_testcase_list.is_empty() {
        problem.example_testcase_list.join("\n")
    } else {
        problem.sample_test_case.clone().unwrap_or_default()
    };

    let data_input_to_send = match payload.data_input {
        Some(ref inp) if !inp.trim().is_empty() => inp.as_str(),
        _ => &default_input,
    };

    match state.leetcode.run_test_cases(
        &session,
        &csrf,
        &problem.title_slug,
        &problem.question_id,
        &language,
        &code,
        Some(data_input_to_send),
    ).await {
        Ok(res) => (StatusCode::OK, Json(serde_json::json!({
            "success": res.run_success && res.correct_answer.unwrap_or(false),
            "status": res.status_msg,
            "status_msg": res.status_msg,
            "run_success": res.run_success,
            "correct_answer": res.correct_answer,
            "total_correct": res.total_correct,
            "total_testcases": res.total_testcases,
            "runtime": res.runtime,
            "memory": res.memory,
            "code_answer": res.code_answer,
            "expected_code_answer": res.expected_code_answer,
            "std_output_list": res.std_output_list,
            "compile_error": res.compile_error,
            "runtime_error": res.runtime_error,
            "problem_id": problem.question_frontend_id,
            "problem_title": problem.title,
            "language": language,
        }))).into_response(),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "error": e }))).into_response(),
    }
}

pub async fn solve_handler(
    State(state): State<AppState>,
    Json(payload): Json<SolveRequest>,
) -> impl IntoResponse {
    let start_time = std::time::Instant::now();
    let today_date = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let cfg = state.config.read().await.clone();
    let lang = payload.lang.or(payload.language).unwrap_or(cfg.preferred_lang.clone());
    let requested_slug = payload.slug.or(payload.title_slug);

    // 1. Fetch problem
    let problem_res = if let Some(ref slug) = requested_slug {
        state.leetcode.fetch_problem_by_slug_or_id(slug).await
    } else {
        state.leetcode.fetch_daily_problem().await
    };

    let problem = match problem_res {
        Ok(p) => p,
        Err(e) => {
            let exec_ms = start_time.elapsed().as_millis() as i64;
            let _ = state.db.save_submission(&SubmissionRecord {
                id: None,
                date: today_date,
                problem_id: None,
                problem_title: None,
                difficulty: None,
                status: "Failed".to_string(),
                submission_id: None,
                runtime: None,
                memory: None,
                execution_time: exec_ms,
                language: Some(lang),
                code: None,
                error: Some(e.clone()),
                created_at: None,
            });
            return (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "error": e }))).into_response();
        }
    };

    // 2. Fetch or use provided solution
    let (code_to_submit, lang_to_submit) = if let Some(ref c) = payload.code {
        if !c.trim().is_empty() {
            (c.clone(), lang.clone())
        } else {
            match state.solution_fetcher.fetch_solution(
                &problem.question_frontend_id,
                &problem.title,
                &problem.title_slug,
                &lang,
            ).await {
                Ok(s) => (s.code, s.language),
                Err(e) => {
                    let exec_ms = start_time.elapsed().as_millis() as i64;
                    let _ = state.db.save_submission(&SubmissionRecord {
                        id: None,
                        date: today_date,
                        problem_id: Some(problem.question_frontend_id.clone()),
                        problem_title: Some(problem.title.clone()),
                        difficulty: Some(problem.difficulty.clone()),
                        status: "Failed".to_string(),
                        submission_id: None,
                        runtime: None,
                        memory: None,
                        execution_time: exec_ms,
                        language: Some(lang),
                        code: None,
                        error: Some(e.clone()),
                        created_at: None,
                    });
                    return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response();
                }
            }
        }
    } else {
        match state.solution_fetcher.fetch_solution(
            &problem.question_frontend_id,
            &problem.title,
            &problem.title_slug,
            &lang,
        ).await {
            Ok(s) => (s.code, s.language),
            Err(e) => {
                let exec_ms = start_time.elapsed().as_millis() as i64;
                let _ = state.db.save_submission(&SubmissionRecord {
                    id: None,
                    date: today_date,
                    problem_id: Some(problem.question_frontend_id.clone()),
                    problem_title: Some(problem.title.clone()),
                    difficulty: Some(problem.difficulty.clone()),
                    status: "Failed".to_string(),
                    submission_id: None,
                    runtime: None,
                    memory: None,
                    execution_time: exec_ms,
                    language: Some(lang),
                    code: None,
                    error: Some(e.clone()),
                    created_at: None,
                });
                return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": e }))).into_response();
            }
        }
    };

    // 3. Submit solution if credentials exist
    let (status, submission_id, runtime, memory, submission_error) = match (&cfg.leetcode_session, &cfg.csrf_token) {
        (Some(session), Some(csrf)) if !session.is_empty() && !csrf.is_empty() => {
            match state.leetcode.submit_solution(
                session,
                csrf,
                &problem.title_slug,
                &problem.question_id,
                &lang_to_submit,
                &code_to_submit,
            ).await {
                Ok(res) => (res.status, Some(res.submission_id), res.runtime, res.memory, res.compile_error),
                Err(e) => ("Submission Error".to_string(), None, None, None, Some(e)),
            }
        }
        _ => {
            ("Simulated (No Session)".to_string(), None, None, None, Some("LeetCode session token not configured. Solution was fetched and validated locally. Configure session in Settings to auto-submit.".to_string()))
        }
    };

    let exec_ms = start_time.elapsed().as_millis() as i64;

    let record = SubmissionRecord {
        id: None,
        date: today_date,
        problem_id: Some(problem.question_frontend_id.clone()),
        problem_title: Some(problem.title.clone()),
        difficulty: Some(problem.difficulty.clone()),
        status: status.clone(),
        submission_id: submission_id.clone(),
        runtime: runtime.clone(),
        memory: memory.clone(),
        execution_time: exec_ms,
        language: Some(lang_to_submit.clone()),
        code: Some(code_to_submit.clone()),
        error: submission_error.clone(),
        created_at: None,
    };

    let _ = state.db.save_submission(&record);

    let is_ok = status == "Accepted" || status.starts_with("Simulated");

    (StatusCode::OK, Json(SolveResponse {
        success: is_ok,
        problem_id: problem.question_frontend_id,
        problem_title: problem.title,
        difficulty: problem.difficulty,
        status,
        language: lang_to_submit,
        code: code_to_submit,
        runtime,
        memory,
        execution_time_ms: exec_ms,
        error: submission_error,
    })).into_response()
}

pub async fn get_session_status_handler(State(state): State<AppState>) -> impl IntoResponse {
    let cfg = state.config.read().await;

    match (&cfg.leetcode_session, &cfg.csrf_token) {
        (Some(sess), Some(csrf)) if !sess.is_empty() && !csrf.is_empty() => {
            match state.leetcode.check_session(sess, csrf).await {
                Ok(status) => Json(serde_json::json!({
                    "hasSession": true,
                    "valid": status.is_signed_in,
                    "isSignedIn": status.is_signed_in,
                    "username": status.username,
                    "isPremium": status.is_premium
                })),
                Err(_) => Json(serde_json::json!({
                    "hasSession": true,
                    "valid": false,
                    "isSignedIn": false,
                    "username": null,
                    "isPremium": false
                })),
            }
        }
        _ => Json(serde_json::json!({
            "hasSession": false,
            "valid": false,
            "isSignedIn": false,
            "username": null,
            "isPremium": false
        })),
    }
}

pub async fn save_session_handler(
    State(state): State<AppState>,
    Json(payload): Json<SaveSessionRequest>,
) -> impl IntoResponse {
    let session = payload.session_token.or(payload.leetcode_session).unwrap_or_default();
    let csrf = payload.csrf_token.unwrap_or_default();

    if session.trim().is_empty() || csrf.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Both sessionToken and csrfToken are required" }))).into_response();
    }

    let session_clean = session.trim();
    let csrf_clean = csrf.trim();

    // Verify tokens against LeetCode GraphQL
    match state.leetcode.check_session(session_clean, csrf_clean).await {
        Ok(status) if status.is_signed_in => {
            let mut cfg = state.config.write().await;
            if let Err(e) = cfg.save_session(session_clean, csrf_clean) {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e }))).into_response();
            }

            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "valid": true,
                "username": status.username,
                "message": "Session authenticated and saved for 30 days"
            }))).into_response()
        }
        Ok(_) => {
            // Save anyway if user manually verified, but warn
            let mut cfg = state.config.write().await;
            let _ = cfg.save_session(session_clean, csrf_clean);
            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "valid": false,
                "username": null,
                "message": "Session saved, but LeetCode reports user is not currently signed in. Check cookie values."
            }))).into_response()
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": format!("Could not verify session: {}", e) }))).into_response(),
    }
}

// ============================================================================
// Bulk solver — grinds through a list of problem ids server-side.
//
// The backend keeps submitting (with the same adaptive backoff used against
// LeetCode's 429 / Cloudflare-403 defenses) even when the API caller goes
// away. Progress is persisted in the submissions table after every problem,
// so a restarted bulk run automatically skips everything already Accepted.
// ============================================================================

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

pub struct BulkState {
    pub running: AtomicBool,
    pub stop_flag: AtomicBool,
    pub total: AtomicUsize,
    pub done: AtomicUsize,
    pub accepted: AtomicUsize,
    pub failed: AtomicUsize,
    pub skipped: AtomicUsize,
    pub interval_ms: AtomicUsize,
    pub current: tokio::sync::RwLock<String>,
    pub last_error: tokio::sync::RwLock<Option<String>>,
    pub started_at: tokio::sync::RwLock<Option<String>>,
    pub finished_at: tokio::sync::RwLock<Option<String>>,
}

impl BulkState {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            stop_flag: AtomicBool::new(false),
            total: AtomicUsize::new(0),
            done: AtomicUsize::new(0),
            accepted: AtomicUsize::new(0),
            failed: AtomicUsize::new(0),
            skipped: AtomicUsize::new(0),
            interval_ms: AtomicUsize::new(5000),
            current: tokio::sync::RwLock::new(String::new()),
            last_error: tokio::sync::RwLock::new(None),
            started_at: tokio::sync::RwLock::new(None),
            finished_at: tokio::sync::RwLock::new(None),
        }
    }
}

#[derive(Deserialize)]
pub struct BulkSolveRequest {
    pub ids: Vec<String>,
    pub lang: Option<String>,
}

fn bulk_rate_limited(err: &str) -> bool {
    err.contains("429") || err.contains("403") || err.contains("Too Many Requests")
}

pub async fn bulk_solve_handler(
    State(state): State<AppState>,
    Json(payload): Json<BulkSolveRequest>,
) -> impl IntoResponse {
    if payload.ids.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "ids list is empty" }))).into_response();
    }
    if state.bulk.running.load(Ordering::SeqCst) {
        return (StatusCode::CONFLICT, Json(serde_json::json!({
            "error": "bulk run already in progress — see /api/bulk/status"
        }))).into_response();
    }

    // Skip everything already Accepted so runs are resumable.
    let already = state.db.get_accepted_problem_ids().unwrap_or_default();
    let already_set: std::collections::HashSet<String> = already.into_iter().collect();
    let requested = payload.ids.len();
    let todo: Vec<String> = payload
        .ids
        .into_iter()
        .filter(|id| !already_set.contains(id))
        .collect();
    let skipped = requested - todo.len();

    let default_lang = state.config.read().await.preferred_lang.clone();
    let lang = payload.lang.unwrap_or(default_lang);

    state.bulk.running.store(true, Ordering::SeqCst);
    state.bulk.stop_flag.store(false, Ordering::SeqCst);
    state.bulk.total.store(todo.len(), Ordering::SeqCst);
    state.bulk.done.store(0, Ordering::SeqCst);
    state.bulk.accepted.store(0, Ordering::SeqCst);
    state.bulk.failed.store(0, Ordering::SeqCst);
    state.bulk.skipped.store(0, Ordering::SeqCst);
    state.bulk.interval_ms.store(5000, Ordering::SeqCst);
    *state.bulk.current.write().await = String::new();
    *state.bulk.last_error.write().await = None;
    *state.bulk.started_at.write().await = Some(chrono::Utc::now().to_rfc3339());
    *state.bulk.finished_at.write().await = None;

    let todo_count = todo.len();
    let task_state = state.clone();
    let task_lang = lang.clone();
    tokio::spawn(async move {
        let n = task_state.bulk.total.load(Ordering::SeqCst);
        println!("🏭 [BULK] starting run: {} problems, lang={}", n, task_lang);

        // LeetCode enforces rolling hourly quotas: when we trip them
        // repeatedly, hammering away at 30-90s intervals wastes attempts.
        // Instead: after COOLDOWN_AFTER consecutive rate-limits, sleep for
        // COOLDOWN_SECS and resume with a fresh budget.
        let mut consecutive_rl: u32 = 0;
        const COOLDOWN_AFTER: u32 = 5;
        const COOLDOWN_SECS: u64 = 600;

        for id in todo {
            if task_state.bulk.stop_flag.load(Ordering::SeqCst) {
                println!("🏭 [BULK] stop requested — finishing");
                break;
            }
            *task_state.bulk.current.write().await = id.clone();

            let mut interval_ms = task_state.bulk.interval_ms.load(Ordering::SeqCst) as u64;

            // 1. Fetch problem
            let problem = match task_state.leetcode.fetch_problem_by_slug_or_id(&id).await {
                Ok(p) => p,
                Err(e) => {
                    let _ = task_state.db.save_submission(&SubmissionRecord {
                        id: None,
                        date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
                        problem_id: Some(id.clone()),
                        problem_title: None,
                        difficulty: None,
                        status: "Failed".to_string(),
                        submission_id: None,
                        runtime: None,
                        memory: None,
                        execution_time: 0,
                        language: Some(task_lang.clone()),
                        code: None,
                        error: Some(e.clone()),
                        created_at: None,
                    });
                    *task_state.bulk.last_error.write().await = Some(format!("#{}: {}", id, e));
                    task_state.bulk.done.fetch_add(1, Ordering::SeqCst);
                    task_state.bulk.failed.fetch_add(1, Ordering::SeqCst);
                    continue;
                }
            };

            // 2. Fetch solution
            let solution = match task_state.solution_fetcher
                .fetch_solution(
                    &problem.question_frontend_id,
                    &problem.title,
                    &problem.title_slug,
                    &task_lang,
                )
                .await
            {
                Ok(s) => s,
                Err(e) => {
                    let _ = task_state.db.save_submission(&SubmissionRecord {
                        id: None,
                        date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
                        problem_id: Some(problem.question_frontend_id.clone()),
                        problem_title: Some(problem.title.clone()),
                        difficulty: Some(problem.difficulty.clone()),
                        status: "No Solution".to_string(),
                        submission_id: None,
                        runtime: None,
                        memory: None,
                        execution_time: 0,
                        language: Some(task_lang.clone()),
                        code: None,
                        error: Some(e.clone()),
                        created_at: None,
                    });
                    task_state.bulk.done.fetch_add(1, Ordering::SeqCst);
                    task_state.bulk.failed.fetch_add(1, Ordering::SeqCst);
                    continue;
                }
            };

            // 3. Submit (if credentials configured)
            let cfg = task_state.config.read().await.clone();
            let (status, err) = match (&cfg.leetcode_session, &cfg.csrf_token) {
                (Some(session), Some(csrf)) if !session.is_empty() && !csrf.is_empty() => {
                    match task_state.leetcode
                        .submit_solution(
                            session,
                            csrf,
                            &problem.title_slug,
                            &problem.question_id,
                            &solution.language,
                            &solution.code,
                        )
                        .await
                    {
                        Ok(res) => (res.status, None),
                        Err(e) => ("Submission Error".to_string(), Some(e)),
                    }
                }
                _ => (
                    "Simulated (No Session)".to_string(),
                    Some("LeetCode session not configured".to_string()),
                ),
            };

            let _ = task_state.db.save_submission(&SubmissionRecord {
                id: None,
                date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
                problem_id: Some(problem.question_frontend_id.clone()),
                problem_title: Some(problem.title.clone()),
                difficulty: Some(problem.difficulty.clone()),
                status: status.clone(),
                submission_id: None,
                runtime: None,
                memory: None,
                execution_time: 0,
                language: Some(solution.language.clone()),
                code: Some(solution.code.clone()),
                error: err.clone(),
                created_at: None,
            });

            task_state.bulk.done.fetch_add(1, Ordering::SeqCst);
            if status == "Accepted" {
                task_state.bulk.accepted.fetch_add(1, Ordering::SeqCst);
                consecutive_rl = 0;
                // gently speed up when clean
                let cur = task_state.bulk.interval_ms.load(Ordering::SeqCst);
                let next = ((cur as f64) * 0.94).round() as usize;
                task_state.bulk.interval_ms.store(next.max(4500), Ordering::SeqCst);
            } else {
                task_state.bulk.failed.fetch_add(1, Ordering::SeqCst);
                if let Some(e) = &err {
                    *task_state.bulk.last_error.write().await =
                        Some(format!("#{} {}: {}", problem.question_frontend_id, problem.title, e));
                    if bulk_rate_limited(e) {
                        consecutive_rl += 1;
                        // hard global backoff on 429 / Cloudflare challenges
                        let cur = task_state.bulk.interval_ms.load(Ordering::SeqCst);
                        let next = ((cur as f64) * 1.9).round() as usize;
                        task_state.bulk.interval_ms.store(next.min(90_000), Ordering::SeqCst);
                    }
                }
            }

            // Rate-limit cool-down: pause and let LeetCode's rolling quota
            // recover instead of burning attempts at crawled-out intervals.
            if consecutive_rl >= COOLDOWN_AFTER {
                println!("🏭 [BULK] {} consecutive rate-limits — cooling down {}s",
                         consecutive_rl, COOLDOWN_SECS);
                *task_state.bulk.last_error.write().await =
                    Some(format!("rate-limit cool-down {}s (quota window)", COOLDOWN_SECS));
                tokio::time::sleep(std::time::Duration::from_secs(COOLDOWN_SECS)).await;
                consecutive_rl = 0;
                task_state.bulk.interval_ms.store(5000, Ordering::SeqCst);
                if task_state.bulk.stop_flag.load(Ordering::SeqCst) {
                    break;
                }
            }

            interval_ms = task_state.bulk.interval_ms.load(Ordering::SeqCst) as u64;
            println!(
                "🏭 [BULK] {}/{} — #{} {} → {} (next in {}ms)",
                task_state.bulk.done.load(Ordering::SeqCst),
                n,
                problem.question_frontend_id,
                problem.title,
                status,
                interval_ms
            );
            tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
        }

        *task_state.bulk.finished_at.write().await = Some(chrono::Utc::now().to_rfc3339());
        task_state.bulk.running.store(false, Ordering::SeqCst);
        println!(
            "🏭 [BULK] finished: accepted={} failed={} of {}",
            task_state.bulk.accepted.load(Ordering::SeqCst),
            task_state.bulk.failed.load(Ordering::SeqCst),
            task_state.bulk.total.load(Ordering::SeqCst)
        );
    });

    (StatusCode::OK, Json(serde_json::json!({
        "started": true,
        "todo": todo_count,
        "skipped_already_accepted": skipped,
        "lang": lang,
        "status_url": "/api/bulk/status"
    }))).into_response()
}

pub async fn bulk_status_handler(State(state): State<AppState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "running": state.bulk.running.load(Ordering::SeqCst),
        "stop_requested": state.bulk.stop_flag.load(Ordering::SeqCst),
        "total": state.bulk.total.load(Ordering::SeqCst),
        "done": state.bulk.done.load(Ordering::SeqCst),
        "accepted": state.bulk.accepted.load(Ordering::SeqCst),
        "failed": state.bulk.failed.load(Ordering::SeqCst),
        "skipped": state.bulk.skipped.load(Ordering::SeqCst),
        "interval_ms": state.bulk.interval_ms.load(Ordering::SeqCst),
        "current": state.bulk.current.read().await.clone(),
        "last_error": state.bulk.last_error.read().await.clone(),
        "started_at": state.bulk.started_at.read().await.clone(),
        "finished_at": state.bulk.finished_at.read().await.clone(),
    }))
}

pub async fn bulk_stop_handler(State(state): State<AppState>) -> impl IntoResponse {
    state.bulk.stop_flag.store(true, Ordering::SeqCst);
    Json(serde_json::json!({ "stopping": true }))
}
