#!/bin/bash
set -e

echo "🚀 Starting LeetCode Autonomous Solver (Rust Core + React SPA)..."
echo ""

# Ensure cargo is on PATH if installed locally
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

# Check for release binary
if [ -f "./leetcode-auto-solver" ]; then
    BINARY="./leetcode-auto-solver"
elif [ -f "./target/release/leetcode-auto-solver" ]; then
    BINARY="./target/release/leetcode-auto-solver"
else
    echo "📦 Compiling Rust release binary..."
    cargo build --release
    BINARY="./target/release/leetcode-auto-solver"
fi

echo "🌐 Launching server on port ${PORT:-3000}..."
exec "$BINARY"
