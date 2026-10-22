use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE, COOKIE, ORIGIN, REFERER, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

const LEETCODE_URL: &str = "https://leetcode.com";
const GRAPHQL_URL: &str = "https://leetcode.com/graphql";
const USER_AGENT_VAL: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicTag {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSnippet {
    pub lang: String,
    #[serde(rename = "langSlug")]
    pub lang_slug: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeetCodeProblem {
    pub question_id: String,
    pub question_frontend_id: String,
    pub title: String,
    pub title_slug: String,
    pub difficulty: String,
    pub content: Option<String>,
    pub date: Option<String>,
    pub topic_tags: Vec<TopicTag>,
    pub code_snippets: Vec<CodeSnippet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmissionResult {
    pub submission_id: String,
    pub status: String,
    pub runtime: Option<String>,
    pub memory: Option<String>,
    pub total_correct: Option<i64>,
    pub total_testcases: Option<i64>,
    pub runtime_percentile: Option<f64>,
    pub memory_percentile: Option<f64>,
    pub compile_error: Option<String>,
    pub full_response: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStatus {
    pub is_signed_in: bool,
    pub username: Option<String>,
    pub is_premium: bool,
}

pub struct LeetCodeClient {
    client: reqwest::Client,
}

impl LeetCodeClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();
        Self { client }
    }

    pub async fn fetch_daily_problem(&self) -> Result<LeetCodeProblem, String> {
        let query = r#"
            query questionOfToday {
                activeDailyCodingChallengeQuestion {
                    date
                    link
                    question {
                        questionId
                        questionFrontendId
                        title
                        titleSlug
                        difficulty
                        content
                        topicTags {
                            name
                            slug
                        }
                        codeSnippets {
                            lang
                            langSlug
                            code
                        }
                    }
                }
            }
        "#;

        let payload = serde_json::json!({
            "query": query,
            "operationName": "questionOfToday"
        });

        let resp = self.client.post(GRAPHQL_URL)
            .header(CONTENT_TYPE, "application/json")
            .header(USER_AGENT, USER_AGENT_VAL)
            .header(REFERER, format!("{}/problemset/all/", LEETCODE_URL))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to send GraphQL request: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("LeetCode GraphQL error status: {}", resp.status()));
        }

        let body: serde_json::Value = resp.json()
            .await
            .map_err(|e| format!("Failed to parse GraphQL response: {}", e))?;

        let challenge = body.get("data")
            .and_then(|d| d.get("activeDailyCodingChallengeQuestion"))
            .ok_or_else(|| "No daily coding challenge found in response".to_string())?;

        let date = challenge.get("date").and_then(|v| v.as_str()).map(|s| s.to_string());
        let q = challenge.get("question")
            .ok_or_else(|| "Question data missing in daily challenge response".to_string())?;

        Self::parse_problem_json(q, date)
    }

    pub async fn fetch_problem_by_slug(&self, slug: &str) -> Result<LeetCodeProblem, String> {
        let query = r#"
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                    content
                    topicTags {
                        name
                        slug
                    }
                    codeSnippets {
                        lang
                        langSlug
                        code
                    }
                }
            }
        "#;

        let payload = serde_json::json!({
            "query": query,
            "variables": { "titleSlug": slug },
            "operationName": "questionData"
        });

        let resp = self.client.post(GRAPHQL_URL)
            .header(CONTENT_TYPE, "application/json")
            .header(USER_AGENT, USER_AGENT_VAL)
            .header(REFERER, format!("{}/problems/{}/", LEETCODE_URL, slug))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to request problem data: {}", e))?;

        let body: serde_json::Value = resp.json()
            .await
            .map_err(|e| format!("Failed to parse problem JSON: {}", e))?;

        let q = body.get("data")
            .and_then(|d| d.get("question"))
            .ok_or_else(|| format!("Problem '{}' not found on LeetCode", slug))?;

        if q.is_null() {
            return Err(format!("Problem '{}' does not exist", slug));
        }

        Self::parse_problem_json(q, None)
    }

    fn parse_problem_json(q: &serde_json::Value, date: Option<String>) -> Result<LeetCodeProblem, String> {
        let question_id = q.get("questionId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let question_frontend_id = q.get("questionFrontendId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let title = q.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let title_slug = q.get("titleSlug")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let difficulty = q.get("difficulty")
            .and_then(|v| v.as_str())
            .unwrap_or("Medium")
            .to_string();
        let content = q.get("content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let mut topic_tags = Vec::new();
        if let Some(tags) = q.get("topicTags").and_then(|v| v.as_array()) {
            for tag in tags {
                let name = tag.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let slug = tag.get("slug").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if !name.is_empty() {
                    topic_tags.push(TopicTag { name, slug });
                }
            }
        }

        let mut code_snippets = Vec::new();
        if let Some(snippets) = q.get("codeSnippets").and_then(|v| v.as_array()) {
            for snip in snippets {
                let lang = snip.get("lang").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let lang_slug = snip.get("langSlug").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let code = snip.get("code").and_then(|v| v.as_str()).unwrap_or("").to_string();
                code_snippets.push(CodeSnippet { lang, lang_slug, code });
            }
        }

        Ok(LeetCodeProblem {
            question_id,
            question_frontend_id,
            title,
            title_slug,
            difficulty,
            content,
            date,
            topic_tags,
            code_snippets,
        })
    }

    pub async fn check_session(&self, session_token: &str, csrf_token: &str) -> Result<SessionStatus, String> {
        let query = r#"
            query globalData {
                userStatus {
                    isSignedIn
                    username
                    userSlug
                    isPremium
                }
            }
        "#;

        let payload = serde_json::json!({
            "query": query,
            "operationName": "globalData"
        });

        let cookie_str = format!("LEETCODE_SESSION={}; csrftoken={}", session_token, csrf_token);

        let resp = self.client.post(GRAPHQL_URL)
            .header(CONTENT_TYPE, "application/json")
            .header(COOKIE, &cookie_str)
            .header("x-csrftoken", csrf_token)
            .header(REFERER, LEETCODE_URL)
            .header(USER_AGENT, USER_AGENT_VAL)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Failed to verify session: {}", e))?;

        let body: serde_json::Value = resp.json()
            .await
            .map_err(|e| format!("Failed to parse session check response: {}", e))?;

        if let Some(user_status) = body.get("data").and_then(|d| d.get("userStatus")) {
            let is_signed_in = user_status.get("isSignedIn").and_then(|v| v.as_bool()).unwrap_or(false);
            let username = user_status.get("username").and_then(|v| v.as_str()).map(|s| s.to_string());
            let is_premium = user_status.get("isPremium").and_then(|v| v.as_bool()).unwrap_or(false);
            return Ok(SessionStatus {
                is_signed_in,
                username,
                is_premium,
            });
        }

        Ok(SessionStatus {
            is_signed_in: false,
            username: None,
            is_premium: false,
        })
    }

    pub async fn submit_solution(
        &self,
        session_token: &str,
        csrf_token: &str,
        problem_slug: &str,
        question_id: &str,
        lang: &str,
        code: &str,
    ) -> Result<SubmissionResult, String> {
        let submit_url = format!("{}/problems/{}/submit/", LEETCODE_URL, problem_slug);
        let cookie_str = format!("LEETCODE_SESSION={}; csrftoken={}", session_token, csrf_token);

        let payload = serde_json::json!({
            "lang": lang,
            "question_id": question_id,
            "typed_code": code
        });

        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(COOKIE, HeaderValue::from_str(&cookie_str).map_err(|e| e.to_string())?);
        headers.insert("x-csrftoken", HeaderValue::from_str(csrf_token).map_err(|e| e.to_string())?);
        headers.insert(REFERER, HeaderValue::from_str(&format!("{}/problems/{}/", LEETCODE_URL, problem_slug)).map_err(|e| e.to_string())?);
        headers.insert(ORIGIN, HeaderValue::from_static(LEETCODE_URL));
        headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VAL));

        let submit_resp = self.client.post(&submit_url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Submission network error: {}", e))?;

        if !submit_resp.status().is_success() {
            let status = submit_resp.status();
            let err_text = submit_resp.text().await.unwrap_or_default();
            return Err(format!("Submission rejected by LeetCode ({}): {}", status, err_text));
        }

        let submit_json: serde_json::Value = submit_resp.json()
            .await
            .map_err(|e| format!("Failed to parse submission response: {}", e))?;

        let submission_id = match submit_json.get("submission_id") {
            Some(v) if v.is_number() => v.as_i64().unwrap_or(0).to_string(),
            Some(v) if v.is_string() => v.as_str().unwrap_or("").to_string(),
            _ => {
                let err_msg = submit_json.get("error").and_then(|v| v.as_str()).unwrap_or("Unknown error");
                return Err(format!("Failed to retrieve submission ID: {}", err_msg));
            }
        };

        if submission_id.is_empty() || submission_id == "0" {
            return Err(format!("Invalid submission ID: {:?}", submit_json));
        }

        println!("🚀 Submission sent! ID: {}, checking result...", submission_id);

        // Poll check endpoint
        let check_url = format!("{}/submissions/detail/{}/check/", LEETCODE_URL, submission_id);

        for attempt in 1..=12 {
            sleep(Duration::from_millis(1500)).await;

            let check_resp = self.client.get(&check_url)
                .header(COOKIE, &cookie_str)
                .header(USER_AGENT, USER_AGENT_VAL)
                .header(REFERER, format!("{}/submissions/detail/{}/", LEETCODE_URL, submission_id))
                .send()
                .await;

            if let Ok(resp) = check_resp {
                if let Ok(result_json) = resp.json::<serde_json::Value>().await {
                    let state = result_json.get("state").and_then(|v| v.as_str()).unwrap_or("");
                    if state == "SUCCESS" {
                        let status = result_json.get("status_msg")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Unknown")
                            .to_string();
                        let runtime = result_json.get("status_runtime")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let memory = result_json.get("status_memory")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        let total_correct = result_json.get("total_correct").and_then(|v| v.as_i64());
                        let total_testcases = result_json.get("total_testcases").and_then(|v| v.as_i64());
                        let runtime_percentile = result_json.get("runtime_percentile").and_then(|v| v.as_f64());
                        let memory_percentile = result_json.get("memory_percentile").and_then(|v| v.as_f64());
                        let compile_error = result_json.get("full_compile_error").and_then(|v| v.as_str()).map(|s| s.to_string());

                        return Ok(SubmissionResult {
                            submission_id,
                            status,
                            runtime,
                            memory,
                            total_correct,
                            total_testcases,
                            runtime_percentile,
                            memory_percentile,
                            compile_error,
                            full_response: result_json,
                        });
                    }
                }
            }

            println!("⏳ Waiting for submission evaluation... attempt {}/12", attempt);
        }

        Err(format!("Submission {} timed out during evaluation", submission_id))
    }
}
