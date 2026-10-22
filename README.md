# ⚡ LeetCode Autonomous Solver (Rust Core + React SPA)

A high-performance, ultra-lightweight autonomous LeetCode solver engineered in **Rust** with an interactive **React SPA** frontend. Designed for zero-cost, low-memory (< 15 MB RAM) 24/7 deployment on Render.

---

## 🌟 Key Features

- **🦀 Native Rust Engine**: Axum 0.7 + Tokio async runtime. Zero bloat, instant startup (< 50ms), and < 15MB memory footprint.
- **⚛️ Modern React SPA**: Built with Vite, React Router, and Lucide icons. Glassmorphic dark design system with live metrics, code viewers, and modals.
- **🌐 Official LeetCode GraphQL**: Direct communication with LeetCode's official GraphQL engine. No broken 3rd-party proxies or rate limit traps.
- **📚 3,500+ Solution Archive**: Seamlessly queries and extracts multi-language solutions (TypeScript, Python3, Rust, Go, Java, C++) from `doocs/leetcode` with fallback layers.
- **⏰ Autonomous Daily Cron**: Integrated `tokio-cron-scheduler` runs daily at 10:00 AM UTC (customizable).
- **🔄 GitHub Actions Workflow**: Automated daily solving and repository sync workflow (`.github/workflows/sync-solutions.yml`).
- **🔐 Cloudflare-Resilient Auth**: Secure browser cookie authentication (`LEETCODE_SESSION` + `csrftoken`) with live validation against LeetCode GraphQL.
- **💾 SQLite Audit Ledger**: Resilient persistence tracking problem titles, slugs, runtime, memory, and submitted code.

---

## 🧭 Application Routes & UI

- `/`: **Dashboard** — Live performance metrics, today's challenge glance, and recent submission table.
- `/daily`: **Daily Challenge** — Live problem sync, HTML description viewer, multi-language solution inspector, and one-click solver.
- `/solver`: **Custom Problem Solver** — Instant lookup and submission for any of the 3,500+ LeetCode problems by slug or URL.
- `/history`: **Submission Audit** — Filterable history ledger with search by status/difficulty and code viewer modals.
- `/settings`: **Session & Settings** — Live session test, 60-second cookie extraction guide, and system diagnostics.

---

## 🚀 Quick Start (Local)

### Prerequisites
- [Rust](https://rustup.rs/) (`rustc 1.80+` or `cargo`)
- [Node.js](https://nodejs.org/) (`v18+`)

### 1. Build & Run
```bash
# Build React frontend into public/
cd frontend
npm install
npm run build
cd ..

# Run Rust server
./start.sh
# Server starts on http://localhost:3000
```

### 2. Command-Line Solver (CLI)
You can solve any problem directly from the terminal without starting the web server:
```bash
# Solve today's daily challenge
./solve.sh

# Solve a specific problem in Python 3
./solve.sh two-sum python3

# Solve in Rust
./solve.sh trapping-rain-water rust
```

---

## ☁️ Deployment on Render

### Method A: Docker Deployment (Recommended)
1. Fork or push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/), click **New** → **Web Service** → Connect your GitHub repo.
3. Choose **Docker** environment (Render automatically uses the multi-stage [Dockerfile](file:///Users/utkarsh/Desktop/leetcode-auto-solver/Dockerfile)).
4. Add Environment Variables:
   - `PORT`: `3000`
   - `LEETCODE_SESSION`: Your `LEETCODE_SESSION` cookie from browser.
   - `LEETCODE_CSRF_TOKEN`: Your `csrftoken` cookie from browser.
5. Deploy!

### Method B: Render Blueprint
Use [render.yaml](file:///Users/utkarsh/Desktop/leetcode-auto-solver/render.yaml) directly with Render's Blueprint feature.

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/health` | `GET` | Health check & system status |
| `/api/stats` | `GET` | Aggregated submission statistics & success rate |
| `/api/daily` | `GET` | Today's official daily question from LeetCode GraphQL |
| `/api/problem/:slug` | `GET` | Metadata for any LeetCode question by slug |
| `/api/preview/:slug?lang=...` | `GET` | Previews solution code from GitHub archive |
| `/api/solve` | `POST` | Executes solution fetch and submission to LeetCode |
| `/api/history?limit=N` | `GET` | Audit log of previous submissions |
| `/api/session/status` | `GET` | Verifies active session with LeetCode |
| `/api/session` | `POST` | Validates and persists new session cookies |

---

## 📁 Repository Structure

```
leetcode-auto-solver/
├── src/                          # Rust Backend
│   ├── config.rs                 # Multi-source config loader
│   ├── database.rs               # SQLite manager & metrics
│   ├── handlers.rs               # REST API endpoints
│   ├── leetcode.rs               # LeetCode GraphQL integration
│   ├── main.rs                   # Axum server, router & cron scheduler
│   └── solution.rs               # GitHub solution archive fetcher
├── frontend/                     # React SPA (Vite)
│   ├── src/
│   │   ├── components/           # Navbar, CodeModal, Toast
│   │   ├── context/              # ToastContext
│   │   ├── pages/                # Dashboard, Daily, Solver, History, Settings
│   │   ├── App.jsx               # React Router configuration
│   │   └── index.css             # Glassmorphic design system
│   ├── index.html
│   └── vite.config.js            # Outputs build directly to ../public
├── public/                       # Compiled production frontend
├── solutions/                    # Local solution fallbacks
├── .github/workflows/            # GitHub Actions automated workflows
│   └── sync-solutions.yml
├── Dockerfile                    # Multi-stage lightweight container
├── render.yaml                   # Render deployment configuration
├── Procfile                      # Process file for Render/Heroku
├── start.sh                      # Production startup script
├── solve.sh                      # CLI submission script
└── Cargo.toml                    # Rust dependency definitions
```

---

## 📄 License
MIT License.
