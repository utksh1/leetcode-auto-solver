# Multi-stage lightweight Dockerfile for Render
# ============================================

# Stage 1: Build Rust Backend
FROM rust:latest AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev libsqlite3-dev ca-certificates && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release

# Stage 2: Minimal Production Image (< 35MB)
FROM debian:bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates openssl sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy Rust release executable
COPY --from=builder /app/target/release/leetcode-auto-solver /app/leetcode-auto-solver

# Copy pre-built React SPA assets
COPY public /app/public

ENV PORT=3000
EXPOSE 3000

CMD ["/app/leetcode-auto-solver"]
