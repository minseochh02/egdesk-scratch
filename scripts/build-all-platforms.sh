#!/bin/bash

# Cross-Platform Build Script for EGDesk with PHP Bundling
# This script builds the Electron application for all supported platforms
#
# SCRIPT OUTPUTS:
# ===============
# bundle-php-cross-platform.js:
#   - Creates: php-bundle/macos/{arm64,x64}/php + php-launcher + lib/
#   - Creates: php-bundle/windows/{x64,x86}/php.exe + dependencies
#   - Creates: php-bundle/linux/{x64,arm64}/php + php-launcher
#   - Returns: Cross-platform PHP bundles for all architectures
#
# bundle-php-docker.js:
#   - Creates: php-bundle/linux/x64/php + php-launcher (from Docker)
#   - Creates: php-bundle/linux/arm64/php + php-launcher (from Docker)
#   - Returns: Linux PHP binaries extracted from Docker containers
#
# test-php-detection.js:
#   - Tests: PHPManager platform detection logic
#   - Returns: Console output showing detected platforms and PHP paths
#
# electron-builder --mac:
#   - Creates: release/build/ElectronReact-4.6.0-arm64.dmg
#   - Creates: release/build/ElectronReact-4.6.0.dmg (Intel)
#   - Creates: release/build/mac/ElectronReact.app/
#   - Returns: macOS distribution packages and .app bundle
#
# electron-builder --win:
#   - Creates: release/build/ElectronReact Setup 4.6.0.exe (NSIS installer)
#   - Creates: release/build/ElectronReact 4.6.0.exe (Portable)
#   - Creates: release/build/win-unpacked/ (x64 unpacked)
#   - Creates: release/build/win-ia32-unpacked/ (x86 unpacked)
#   - Returns: Windows installers and portable executables
#
# electron-builder --linux:
#   - Creates: release/build/ElectronReact-4.6.0.AppImage
#   - Creates: release/build/linux-unpacked/
#   - Returns: Linux AppImage and unpacked directory
#
# npm run build:
#   - Creates: release/app/dist/ (compiled TypeScript)
#   - Returns: Built application ready for packaging

set -e  # Exit on any error

echo "🚀 EGDesk Cross-Platform Build Script"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Check if Node.js and npm are available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Function to bundle PHP for current platform
bundle_php() {
    print_status "Bundling PHP for current platform..."
    if [ -f "scripts/bundle-php-cross-platform.js" ]; then
        node scripts/bundle-php-cross-platform.js
        print_success "PHP bundling completed"
    else
        print_warning "PHP bundling script not found, skipping..."
    fi
}

# Function to build TypeScript
build_typescript() {
    print_status "Building TypeScript..."
    npm run build
    print_success "TypeScript build completed"
}

# Function to clean previous builds
clean_builds() {
    print_status "Cleaning previous builds..."
    rm -rf release/build/*
    print_success "Previous builds cleaned"
}

# Function to build for macOS
build_macos() {
    print_status "Building for macOS (ARM64 + Intel)..."
    npx electron-builder --mac
    print_success "macOS build completed"
}

# Function to build for Windows
build_windows() {
    print_status "Building for Windows (x64 + x86)..."
    npx electron-builder --win
    print_success "Windows build completed"
}

# Function to build for Linux
build_linux() {
    print_status "Building for Linux (x64)..."
    npx electron-builder --linux
    print_success "Linux build completed"
}

# Function to build all platforms
build_all() {
    print_status "Building for all platforms..."
    npx electron-builder --mac --win --linux
    print_success "All platform builds completed"
}

# Function to show build results
show_results() {
    print_status "Build Results:"
    echo ""
    
    if [ -d "release/build" ]; then
        echo "📁 Build directory contents:"
        ls -la release/build/
        echo ""
        
        echo "📦 macOS packages:"
        find release/build -name "*.dmg" -o -name "*.app" | head -5
        echo ""
        
        echo "🪟 Windows packages:"
        find release/build -name "*.exe" | head -5
        echo ""
        
        echo "🐧 Linux packages:"
        find release/build -name "*.AppImage" | head -5
        echo ""
        
        echo "🐘 PHP bundles included:"
        find release/build -path "*/php-bundle/*" -name "php*" | wc -l | xargs echo "Total PHP files:"
    else
        print_warning "No build directory found"
    fi
}

# Function to show detailed file outputs for each script
show_script_outputs() {
    echo ""
    print_status "DETAILED SCRIPT OUTPUTS:"
    echo "=========================="
    echo ""
    
    echo "🔧 bundle-php-cross-platform.js OUTPUTS:"
    echo "   📁 php-bundle/macos/arm64/"
    echo "      ├── php (PHP binary)"
    echo "      ├── php-launcher (launcher script)"
    echo "      └── lib/ (dynamic libraries)"
    echo "   📁 php-bundle/macos/x64/"
    echo "      ├── php (PHP binary)"
    echo "      ├── php-launcher (launcher script)"
    echo "      └── lib/ (dynamic libraries)"
    echo "   📁 php-bundle/windows/x64/"
    echo "      ├── php.exe (PHP executable)"
    echo "      ├── php-cgi.exe (CGI executable)"
    echo "      ├── php-win.exe (Windows GUI executable)"
    echo "      └── *.dll (required libraries)"
    echo "   📁 php-bundle/windows/x86/"
    echo "      ├── php.exe (PHP executable)"
    echo "      ├── php-cgi.exe (CGI executable)"
    echo "      ├── php-win.exe (Windows GUI executable)"
    echo "      └── *.dll (required libraries)"
    echo "   📁 php-bundle/linux/x64/"
    echo "      ├── php (PHP binary)"
    echo "      └── php-launcher (launcher script)"
    echo "   📁 php-bundle/linux/arm64/"
    echo "      ├── php (PHP binary)"
    echo "      └── php-launcher (launcher script)"
    echo ""
    
    echo "🐳 bundle-php-docker.js OUTPUTS:"
    echo "   📁 php-bundle/linux/x64/"
    echo "      ├── php (extracted from Docker container)"
    echo "      └── php-launcher (generated launcher script)"
    echo "   📁 php-bundle/linux/arm64/"
    echo "      ├── php (extracted from Docker container)"
    echo "      └── php-launcher (generated launcher script)"
    echo ""
    
    echo "🧪 test-php-detection.js OUTPUTS:"
    echo "   📄 Console output showing:"
    echo "      ├── Detected platform and architecture"
    echo "      ├── Expected PHP paths for each platform"
    echo "      ├── File existence checks"
    echo "      └── Available bundled platforms"
    echo ""
    
    echo "🍎 electron-builder --mac OUTPUTS:"
    echo "   📦 release/build/ElectronReact-4.6.0-arm64.dmg (ARM64 DMG)"
    echo "   📦 release/build/ElectronReact-4.6.0.dmg (Intel DMG)"
    echo "   📁 release/build/mac/ElectronReact.app/ (macOS app bundle)"
    echo "      └── Contents/Resources/php-bundle/ (bundled PHP)"
    echo ""
    
    echo "🪟 electron-builder --win OUTPUTS:"
    echo "   📦 release/build/ElectronReact Setup 4.6.0.exe (NSIS installer)"
    echo "   📦 release/build/ElectronReact 4.6.0.exe (Portable executable)"
    echo "   📁 release/build/win-unpacked/ (x64 unpacked app)"
    echo "      └── resources/php-bundle/ (bundled PHP)"
    echo "   📁 release/build/win-ia32-unpacked/ (x86 unpacked app)"
    echo "      └── resources/php-bundle/ (bundled PHP)"
    echo ""
    
    echo "🐧 electron-builder --linux OUTPUTS:"
    echo "   📦 release/build/ElectronReact-4.6.0.AppImage (Linux AppImage)"
    echo "   📁 release/build/linux-unpacked/ (unpacked app directory)"
    echo "      └── resources/php-bundle/ (bundled PHP)"
    echo ""
    
    echo "⚙️  npm run build OUTPUTS:"
    echo "   📁 release/app/dist/ (compiled TypeScript)"
    echo "      ├── main/ (main process files)"
    echo "      ├── renderer/ (renderer process files)"
    echo "      └── preload/ (preload scripts)"
    echo ""
}

# Function to test PHP detection
test_php_detection() {
    print_status "Testing PHP detection logic..."
    if [ -f "scripts/test-php-detection.js" ]; then
        node scripts/test-php-detection.js
    else
        print_warning "PHP detection test script not found"
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --macos, -m     Build for macOS only"
    echo "  --windows, -w   Build for Windows only"
    echo "  --linux, -l     Build for Linux only"
    echo "  --all, -a       Build for all platforms (default)"
    echo "  --clean, -c     Clean previous builds before building"
    echo "  --php-only      Only bundle PHP, don't build"
    echo "  --test          Test PHP detection logic"
    echo "  --results, -r   Show build results only"
    echo "  --outputs, -o   Show detailed script outputs"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Build all platforms"
    echo "  $0 --macos           # Build macOS only"
    echo "  $0 --clean --all     # Clean and build all"
    echo "  $0 --test            # Test PHP detection"
    echo "  $0 --results         # Show previous build results"
    echo "  $0 --outputs         # Show detailed script outputs"
}

# Parse command line arguments
CLEAN=false
BUILD_MACOS=false
BUILD_WINDOWS=false
BUILD_LINUX=false
BUILD_ALL=true
PHP_ONLY=false
TEST_ONLY=false
SHOW_RESULTS=false
SHOW_OUTPUTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --macos|-m)
            BUILD_MACOS=true
            BUILD_ALL=false
            shift
            ;;
        --windows|-w)
            BUILD_WINDOWS=true
            BUILD_ALL=false
            shift
            ;;
        --linux|-l)
            BUILD_LINUX=true
            BUILD_ALL=false
            shift
            ;;
        --all|-a)
            BUILD_ALL=true
            shift
            ;;
        --clean|-c)
            CLEAN=true
            shift
            ;;
        --php-only)
            PHP_ONLY=true
            shift
            ;;
        --test)
            TEST_ONLY=true
            shift
            ;;
        --results|-r)
            SHOW_RESULTS=true
            shift
            ;;
        --outputs|-o)
            SHOW_OUTPUTS=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo ""
    
    if [ "$SHOW_RESULTS" = true ]; then
        show_results
        exit 0
    fi
    
    if [ "$SHOW_OUTPUTS" = true ]; then
        show_script_outputs
        exit 0
    fi
    
    if [ "$TEST_ONLY" = true ]; then
        test_php_detection
        exit 0
    fi
    
    if [ "$CLEAN" = true ]; then
        clean_builds
    fi
    
    if [ "$PHP_ONLY" = true ]; then
        bundle_php
        exit 0
    fi
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install
    
    # Bundle PHP
    bundle_php
    
    # Build TypeScript
    build_typescript
    
    # Build for requested platforms
    if [ "$BUILD_ALL" = true ]; then
        build_all
    else
        if [ "$BUILD_MACOS" = true ]; then
            build_macos
        fi
        if [ "$BUILD_WINDOWS" = true ]; then
            build_windows
        fi
        if [ "$BUILD_LINUX" = true ]; then
            build_linux
        fi
    fi
    
    # Show results
    show_results
    
    print_success "Build process completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Test the built applications"
    echo "2. Check that PHP is bundled and working"
    echo "3. Distribute the appropriate package for each platform"
}

# Run main function
main "$@"
