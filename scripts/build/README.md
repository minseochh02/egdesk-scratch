# Build Scripts

This folder contains scripts for building and packaging the application.

## Scripts

- **`build-all-platforms.sh`** - Cross-platform build script for EGDesk with PHP bundling
- **`bundle-php-cross-platform.js`** - Creates cross-platform PHP bundles for all architectures
- **`bundle-php-docker.js`** - Creates Linux PHP binaries extracted from Docker containers

## Usage

Run the main build script:
```bash
./build-all-platforms.sh
```

This will execute all the necessary bundling steps for Windows, macOS, and Linux platforms.
