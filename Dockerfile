# Multi-stage lightweight build for Render
# ==========================================
# Stage 1: Build React Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# Stage 2: Build Rust Backend Binary
FROM rust:1.80-slim AS backend-builder
WORKDIR /app
# Install pkg-config, OpenSSL, and SQLite build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
# Cache dependencies with a dummy main
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# Copy real source code and build optimized binary
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Stage 3: Minimal Production Image (< 30MB)
FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates openssl sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy Rust executable
COPY --from=backend-builder /app/target/release/leetcode-auto-solver /app/leetcode-auto-solver
# Copy built React SPA
COPY --from=frontend-builder /app/public /app/public

ENV PORT=3000
EXPOSE 3000

CMD ["/app/leetcode-auto-solver"]
