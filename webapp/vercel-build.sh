#!/bin/bash

# Exit if any command fails
set -e

echo "--- Installing Rust toolchain... ---"
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo "--- Rust toolchain installed. ---"
rustc --version
wasm-pack --version

echo "--- Running original build command... ---"
npm run build 