use regex::Regex;
use std::time::Duration;

/// Hard cap for any fetched solution file. raw.githubusercontent.com files in
/// these repos are a few KB — anything larger is rejected instead of being
/// pulled fully into memory (defence against bloated/malicious responses).
const MAX_SOLUTION_BYTES: usize = 512 * 1024;

pub struct SolutionFetcher {
    client: reqwest::Client,
}

#[derive(Debug, Clone)]
pub struct FetchedSolution {
    pub language: String,
    pub code: String,
    pub source: String,
}

impl SolutionFetcher {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_default();
        Self { client }
    }

    /// Read a response body with a size cap. Returns None when the body
    /// exceeds MAX_SOLUTION_BYTES.
    async fn read_capped(&self, resp: reqwest::Response) -> Option<String> {
        let bytes = resp.bytes().await.ok()?;
        if bytes.len() > MAX_SOLUTION_BYTES {
            return None;
        }
        String::from_utf8(bytes.to_vec()).ok()
    }

    pub fn get_range(frontend_id_str: &str) -> String {
        let num: u32 = frontend_id_str.parse().unwrap_or(0);
        let start = (num / 100) * 100;
        let end = start + 99;
        format!("{:04}-{:04}", start, end)
    }

    pub async fn fetch_solution(
        &self,
        frontend_id: &str,
        title: &str,
        title_slug: &str,
        target_lang: &str,
    ) -> Result<FetchedSolution, String> {
        // 1. Try primary GitHub source: doocs/leetcode
        if let Some(sol) = self.try_doocs_github(frontend_id, title, title_slug, target_lang).await {
            println!("🌐 Successfully retrieved solution from doocs/leetcode: {}", sol.source);
            return Ok(sol);
        }

        // 2. Try secondary GitHub source: walkccc/LeetCode
        if let Some(sol) = self.try_walkccc_github(frontend_id, title_slug, target_lang).await {
            println!("🌐 Successfully retrieved solution from walkccc/LeetCode: {}", sol.source);
            return Ok(sol);
        }

        Err(format!(
            "Could not find solution for problem #{} ({}) in '{}' across GitHub repositories",
            frontend_id, title, target_lang
        ))
    }

    async fn try_doocs_github(
        &self,
        frontend_id: &str,
        title: &str,
        title_slug: &str,
        target_lang: &str,
    ) -> Option<FetchedSolution> {
        let padded_id = format!("{:04}", frontend_id.parse::<u32>().unwrap_or(0));
        let range = Self::get_range(frontend_id);

        // Generate title variations for folder matching
        let clean_title = title.replace("&#39;", "'").replace("&amp;", "&");
        
        let mut title_variants = Vec::new();
        // 1. Exact title as on LeetCode
        title_variants.push(clean_title.replace(' ', "%20"));
        // 2. Capitalized each word
        let capitalized = clean_title
            .split_whitespace()
            .map(|w| {
                let mut c = w.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join("%20");
        title_variants.push(capitalized);
        // 3. Title with special characters like ' or - removed/normalized
        let sanitized = clean_title.replace(['\'', '"', ',', '?', ':', '-'], "");
        title_variants.push(sanitized.replace(' ', "%20"));
        // 4. Title slug words capitalized
        let slug_words = title_slug
            .split('-')
            .map(|w| {
                let mut c = w.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join("%20");
        title_variants.push(slug_words);

        for t in &title_variants {
            for doc in &["README_EN.md", "README.md"] {
                let url = format!(
                    "https://raw.githubusercontent.com/doocs/leetcode/main/solution/{}/{}.{}/{}",
                    range, padded_id, t, doc
                );

                if let Ok(resp) = self.client.get(&url).send().await {
                    if resp.status().is_success() {
                        if let Some(markdown) = self.read_capped(resp).await {
                            // extract_code_from_markdown may fall back to a
                            // different language than requested (e.g. a README
                            // without a Python3 section). Submitting the real
                            // language avoids "Compile Error" results.
                            if let Some((code, actual_lang)) = Self::extract_code_from_markdown(&markdown, target_lang) {
                                return Some(FetchedSolution {
                                    language: actual_lang,
                                    code,
                                    source: url,
                                });
                            }
                        }
                    }
                }
            }
        }

        None
    }

    async fn try_walkccc_github(
        &self,
        frontend_id: &str,
        title_slug: &str,
        target_lang: &str,
    ) -> Option<FetchedSolution> {
        let padded_id = format!("{:04}", frontend_id.parse::<u32>().unwrap_or(0));
        let num = frontend_id.parse::<u32>().unwrap_or(0).to_string();

        let (ext, lang_slug) = match target_lang.to_lowercase().as_str() {
            "python" | "python3" | "py" => ("py", "python3"),
            "java" => ("java", "java"),
            "cpp" | "c++" => ("cpp", "cpp"),
            _ => ("py", "python3"),
        };

        let urls = [
            format!("https://raw.githubusercontent.com/walkccc/LeetCode/main/solutions/{}.{}.{}", padded_id, title_slug, ext),
            format!("https://raw.githubusercontent.com/walkccc/LeetCode/main/solutions/{}.{}.{}", num, title_slug, ext),
        ];

        for url in &urls {
            if let Ok(resp) = self.client.get(url).send().await {
                if resp.status().is_success() {
                    if let Some(raw_code) = self.read_capped(resp).await {
                        let cleaned = Self::clean_code(&raw_code, target_lang);
                        if !cleaned.is_empty() {
                            return Some(FetchedSolution {
                                language: lang_slug.to_string(),
                                code: cleaned,
                                source: url.clone(),
                            });
                        }
                    }
                }
            }
        }

        None
    }

    /// Extract solution code from a doocs/leetcode-style README.
    ///
    /// Returns `(code, lang_slug)` where `lang_slug` is the LeetCode language
    /// slug of the block that was actually matched. When the requested language
    /// has no section, the extractor falls back to TypeScript and then Python3
    /// — the caller must submit using the returned slug, not the requested
    /// language, otherwise LeetCode answers with a compile error.
    pub fn extract_code_from_markdown(markdown: &str, target_lang: &str) -> Option<(String, String)> {
        let (section_header, lang_tags, lang_slug) = match target_lang.to_lowercase().as_str() {
            "typescript" | "ts" => ("TypeScript", vec!["typescript", "ts"], "typescript"),
            "python" | "python3" | "py" => ("Python3", vec!["python3", "python", "py"], "python3"),
            "rust" | "rs" => ("Rust", vec!["rust", "rs"], "rust"),
            "golang" | "go" => ("Go", vec!["golang", "go"], "golang"),
            "java" => ("Java", vec!["java"], "java"),
            "cpp" | "c++" => ("C++", vec!["cpp", "c++", "c"], "cpp"),
            "javascript" | "js" => ("JavaScript", vec!["javascript", "js"], "javascript"),
            _ => ("TypeScript", vec!["typescript", "ts"], "typescript"),
        };

        // Try exact section header: #### <Language>\n\n```<tag>\n...\n```
        for tag in &lang_tags {
            let section_pattern = format!(
                r"(?i)####\s+{}\s*[\r\n]+```(?:{})?[\r\n]+([\s\S]*?)[\r\n]+```",
                regex::escape(section_header),
                regex::escape(tag)
            );
            if let Ok(re) = Regex::new(&section_pattern) {
                if let Some(caps) = re.captures(markdown) {
                    if let Some(matched) = caps.get(1) {
                        return Some((Self::clean_code(matched.as_str(), target_lang), lang_slug.to_string()));
                    }
                }
            }
        }

        // Fallback: match any code block with the tag
        for tag in &lang_tags {
            let codeblock_pattern = format!(r"(?i)```{}\s*[\r\n]+([\s\S]*?)[\r\n]+```", regex::escape(tag));
            if let Ok(re) = Regex::new(&codeblock_pattern) {
                if let Some(caps) = re.captures(markdown) {
                    if let Some(matched) = caps.get(1) {
                        return Some((Self::clean_code(matched.as_str(), target_lang), lang_slug.to_string()));
                    }
                }
            }
        }

        // If requested language not found in markdown, fallback to TypeScript or Python3
        if target_lang != "typescript" {
            if let Some(ts) = Self::extract_code_from_markdown(markdown, "typescript") {
                return Some(ts);
            }
        }
        if target_lang != "python3" {
            if let Some(py) = Self::extract_code_from_markdown(markdown, "python3") {
                return Some(py);
            }
        }

        None
    }

    pub fn clean_code(code: &str, _lang: &str) -> String {
        // Remove markdown comments, tabs and leading empty lines
        let re_multi_comment = Regex::new(r"/\*[\s\S]*?\*/").unwrap();
        let re_single_comment = Regex::new(r"//.*").unwrap();

        let no_multi = re_multi_comment.replace_all(code, "");
        let no_single = re_single_comment.replace_all(&no_multi, "");

        let mut lines = Vec::new();
        for line in no_single.lines() {
            let trimmed = line.trim_end();
            lines.push(trimmed.to_string());
        }

        // Remove leading and trailing empty lines
        while !lines.is_empty() && lines.first().unwrap().trim().is_empty() {
            lines.remove(0);
        }
        while !lines.is_empty() && lines.last().unwrap().trim().is_empty() {
            lines.pop();
        }

        lines.join("\n")
    }
}
