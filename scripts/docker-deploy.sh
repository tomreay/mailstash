#!/bin/bash

# Check if version argument is provided
if [ -z "$1" ]; then
    echo "Error: Version number required"
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION=$1

echo "Building Docker images with version: $VERSION"

# Build app image
echo "Building app image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t gettby/mailstash-app:$VERSION \
    -t gettby/mailstash-app:latest \
    -f Dockerfile.prod \
    --push \
    .

if [ $? -ne 0 ]; then
    echo "Error: Failed to build app image"
    exit 1
fi

echo "App image built successfully"

# Build worker image
echo "Building worker image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t gettby/mailstash-worker:$VERSION \
    -t gettby/mailstash-worker:latest \
    -f Dockerfile.worker \
    --push \
    .

if [ $? -ne 0 ]; then
    echo "Error: Failed to build worker image"
    exit 1
fi

echo "Worker image built successfully"
echo "Both images built and pushed with version: $VERSION"