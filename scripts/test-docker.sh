#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PACKAGE_DIR"

IMAGE_NAME="encapsulate-test"

echo "Building Docker image..."
docker build -t "$IMAGE_NAME" .

echo "Running tests in Docker..."
docker run --rm "$IMAGE_NAME"

echo "Tests completed successfully!"
