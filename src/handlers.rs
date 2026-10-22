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

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub leetcode: Arc<LeetCodeClient>,
    pub solution_fetcher: Arc<SolutionFetcher>,
    pub config: Arc<RwLock<AppConfig>>,
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
