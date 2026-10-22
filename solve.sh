#!/bin/bash
set -e

# Ensure cargo is on PATH if installed locally
if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

if [ -f "./target/release/leetcode-auto-solver" ]; then
    BINARY="./target/release/leetcode-auto-solver"
elif [ -f "./leetcode-auto-solver" ]; then
    BINARY="./leetcode-auto-solver"
else
    cargo build --release
    BINARY="./target/release/leetcode-auto-solver"
fi

exec "$BINARY" solve "$@"
