use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmissionRecord {
    pub id: Option<i64>,
    pub date: String,
    pub problem_id: Option<String>,
    pub problem_title: Option<String>,
    pub difficulty: Option<String>,
    pub status: String,
    pub submission_id: Option<String>,
    pub runtime: Option<String>,
    pub memory: Option<String>,
    pub execution_time: i64,
    pub language: Option<String>,
    pub code: Option<String>,
    pub error: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub total: i64,
    pub accepted: i64,
    pub failed: i64,
    pub success_rate: f64,
    pub avg_execution_time: i64,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        
        // Optimize SQLite performance
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             CREATE TABLE IF NOT EXISTS submissions (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 date TEXT NOT NULL,
                 problem_id TEXT,
                 problem_title TEXT,
                 difficulty TEXT,
                 status TEXT NOT NULL,
                 submission_id TEXT,
                 runtime TEXT,
                 memory TEXT,
                 execution_time INTEGER,
                 language TEXT,
                 code TEXT,
                 error TEXT,
                 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
             );
             CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(date);
             CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);",
        )?;

        println!("✅ SQLite Database initialized at '{}'", path);
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn save_submission(&self, record: &SubmissionRecord) -> Result<i64, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO submissions 
             (date, problem_id, problem_title, difficulty, status, submission_id, runtime, memory, execution_time, language, code, error)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                record.date,
                record.problem_id,
                record.problem_title,
                record.difficulty,
                record.status,
                record.submission_id,
                record.runtime,
                record.memory,
                record.execution_time,
                record.language,
                record.code,
                record.error,
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_history(&self, limit: usize) -> Result<Vec<SubmissionRecord>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, date, problem_id, problem_title, difficulty, status, submission_id, runtime, memory, execution_time, language, code, error, created_at 
             FROM submissions 
             ORDER BY id DESC 
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(SubmissionRecord {
                id: row.get(0)?,
                date: row.get(1)?,
                problem_id: row.get(2)?,
                problem_title: row.get(3)?,
                difficulty: row.get(4)?,
                status: row.get(5)?,
                submission_id: row.get(6)?,
                runtime: row.get(7)?,
                memory: row.get(8)?,
                execution_time: row.get(9)?,
                language: row.get(10)?,
                code: row.get(11)?,
                error: row.get(12)?,
                created_at: row.get(13)?,
            })
        })?;

        let mut results = Vec::new();
        for r in rows {
            results.push(r?);
        }
        Ok(results)
    }

    pub fn get_stats(&self) -> Result<Stats, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM submissions",
            [],
            |r| r.get(0),
        )?;

        let accepted: i64 = conn.query_row(
            "SELECT COUNT(*) FROM submissions WHERE status = 'Accepted'",
            [],
            |r| r.get(0),
        )?;

        let avg_time: f64 = conn.query_row(
            "SELECT COALESCE(AVG(execution_time), 0.0) FROM submissions WHERE status = 'Accepted'",
            [],
            |r| r.get(0),
        )?;

        let failed = total - accepted;
        let success_rate = if total > 0 {
            (accepted as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        Ok(Stats {
            total,
            accepted,
            failed,
            success_rate: (success_rate * 10.0).round() / 10.0,
            avg_execution_time: avg_time.round() as i64,
        })
    }
}
