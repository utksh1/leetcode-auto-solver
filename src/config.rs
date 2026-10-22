use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub leetcode_username: Option<String>,
    pub leetcode_password: Option<String>,
    pub leetcode_session: Option<String>,
    pub csrf_token: Option<String>,
    pub port: u16,
    pub schedule_cron: String,
    pub preferred_lang: String,
    pub db_path: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            leetcode_username: None,
            leetcode_password: None,
            leetcode_session: None,
            csrf_token: None,
            port: 3000,
            schedule_cron: "0 0 10 * * *".to_string(), // 10:00 AM UTC
            preferred_lang: "python3".to_string(),
            db_path: "data.db".to_string(),
        }
    }
}

impl AppConfig {
    pub fn load() -> Self {
        let mut config = Self::default();

        // 1. Load from standard .env file if present
        if Path::new(".env").exists() {
            if let Ok(content) = fs::read_to_string(".env") {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.is_empty() || trimmed.starts_with('#') {
                        continue;
                    }
                    if let Some((key, val)) = trimmed.split_once('=') {
                        let k = key.trim();
                        let v = val.trim().trim_matches('"').trim_matches('\'').to_string();
                        match k {
                            "LEETCODE_SESSION" | "SESSION" | "leetcode_session" => {
                                config.leetcode_session = Some(v);
                            }
                            "LEETCODE_CSRF_TOKEN" | "CSRF_TOKEN" | "LEETCODE_CSRF" | "csrftoken" => {
                                config.csrf_token = Some(v);
                            }
                            "PORT" => {
                                if let Ok(p) = v.parse::<u16>() {
                                    config.port = p;
                                }
                            }
                            "PREFERRED_LANG" => {
                                config.preferred_lang = v;
                            }
                            "DATABASE_PATH" => {
                                config.db_path = v;
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        // 2. Load from .env.json or config.json if present
        for path in &[".env.json", "config.json"] {
            if Path::new(path).exists() {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(s) = parsed.get("leetcode_session")
                            .or_else(|| parsed.get("leetcodeSession"))
                            .or_else(|| parsed.get("LEETCODE_SESSION"))
                            .or_else(|| parsed.get("sessionToken"))
                            .and_then(|v| v.as_str()) {
                            config.leetcode_session = Some(s.to_string());
                        }

                        if let Some(c) = parsed.get("csrf_token")
                            .or_else(|| parsed.get("csrfToken"))
                            .or_else(|| parsed.get("csrftoken"))
                            .or_else(|| parsed.get("LEETCODE_CSRF_TOKEN"))
                            .and_then(|v| v.as_str()) {
                            config.csrf_token = Some(c.to_string());
                        }

                        if let Some(u) = parsed.get("leetcode_username")
                            .or_else(|| parsed.get("leetcodeUsername"))
                            .and_then(|v| v.as_str()) {
                            config.leetcode_username = Some(u.to_string());
                        }

                        if let Some(p) = parsed.get("port").and_then(|v| v.as_u64()) {
                            config.port = p as u16;
                        }

                        if let Some(l) = parsed.get("preferred_lang")
                            .or_else(|| parsed.get("preferredLang"))
                            .and_then(|v| v.as_str()) {
                            config.preferred_lang = l.to_string();
                        }
                    }
                }
                break;
            }
        }

        // 3. Load from session.json if present
        if Path::new("session.json").exists() {
            if let Ok(content) = fs::read_to_string("session.json") {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(s) = parsed.get("sessionToken").or_else(|| parsed.get("leetcode_session")).and_then(|v| v.as_str()) {
                        config.leetcode_session = Some(s.to_string());
                    }
                    if let Some(c) = parsed.get("csrfToken").or_else(|| parsed.get("csrf_token")).and_then(|v| v.as_str()) {
                        config.csrf_token = Some(c.to_string());
                    }
                }
            }
        }

        // 4. OS Environment variables have the highest precedence
        if let Ok(val) = std::env::var("PORT") {
            if let Ok(p) = val.parse::<u16>() {
                config.port = p;
            }
        }
        if let Ok(val) = std::env::var("LEETCODE_USERNAME") {
            config.leetcode_username = Some(val);
        }
        if let Ok(val) = std::env::var("LEETCODE_SESSION").or_else(|_| std::env::var("SESSION")) {
            config.leetcode_session = Some(val);
        }
        if let Ok(val) = std::env::var("LEETCODE_CSRF_TOKEN")
            .or_else(|_| std::env::var("CSRF_TOKEN"))
            .or_else(|_| std::env::var("csrftoken")) {
            config.csrf_token = Some(val);
        }
        if let Ok(val) = std::env::var("PREFERRED_LANG") {
            config.preferred_lang = val;
        }
        if let Ok(val) = std::env::var("DATABASE_PATH") {
            config.db_path = val;
        }

        config
    }

    pub fn save_session(&mut self, session_token: &str, csrf_token: &str) -> Result<(), String> {
        self.leetcode_session = Some(session_token.to_string());
        self.csrf_token = Some(csrf_token.to_string());

        let session_data = serde_json::json!({
            "sessionToken": session_token,
            "csrfToken": csrf_token,
            "updatedAt": chrono::Utc::now().to_rfc3339(),
            "expiresAt": chrono::Utc::now().timestamp_millis() + (30 * 24 * 60 * 60 * 1000)
        });

        fs::write("session.json", serde_json::to_string_pretty(&session_data).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;

        // Also update .env file cleanly
        let env_content = format!(
            "PORT={}\nLEETCODE_SESSION=\"{}\"\nLEETCODE_CSRF_TOKEN=\"{}\"\nPREFERRED_LANG=\"{}\"\n",
            self.port,
            session_token,
            csrf_token,
            self.preferred_lang
        );
        let _ = fs::write(".env", env_content);

        Ok(())
    }
}
