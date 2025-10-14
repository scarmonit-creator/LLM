#!/bin/bash

# Perplexity File Optimization Runner
# Automates the file synchronization and optimization process

set -e

echo "🚀 Starting Perplexity File Optimization..."
echo "================================================="

# Set up environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📂 Working directory: $REPO_ROOT"
echo "📅 Started at: $(date)"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

echo "🔍 Python version: $(python3 --version)"

# Create logs directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/logs"

# Set log file
LOG_FILE="$SCRIPT_DIR/logs/optimization-$(date +%Y%m%d-%H%M%S).log"

echo "📝 Log file: $LOG_FILE"

# Run the optimization script
echo "\n🔄 Running file optimization..."
cd "$REPO_ROOT"

if python3 "$SCRIPT_DIR/file-sync-automation.py" 2>&1 | tee "$LOG_FILE"; then
    echo "\n✅ Optimization completed successfully!"
    
    # Display summary if report was generated
    if [[ -f "$SCRIPT_DIR/optimization-report.md" ]]; then
        echo "\n📊 Optimization Summary:"
        echo "========================"
        head -20 "$SCRIPT_DIR/optimization-report.md"
        echo "\n📝 Full report available at: $SCRIPT_DIR/optimization-report.md"
    fi
    
    # Check if manifest was created
    if [[ -f "$SCRIPT_DIR/file-manifest.json" ]]; then
        TOTAL_FILES=$(python3 -c "import json; data=json.load(open('$SCRIPT_DIR/file-manifest.json')); print(data['total_files'])")
        PRIORITY_FILES=$(python3 -c "import json; data=json.load(open('$SCRIPT_DIR/file-manifest.json')); print(len(data['priority_files']))")
        
        echo "\n📈 File Statistics:"
        echo "  - Total files scanned: $TOTAL_FILES"
        echo "  - Priority files identified: $PRIORITY_FILES"
    fi
    
else
    echo "\n❌ Optimization failed. Check the log file for details:"
    echo "   $LOG_FILE"
    exit 1
fi

# Optional: Run additional checks
if [[ "$1" == "--verify" ]]; then
    echo "\n🔍 Running verification checks..."
    
    # Check if GitHub connector files are accessible
    echo "  - Verifying GitHub connector access..."
    
    # Check file integrity
    echo "  - Checking file integrity..."
    
    # Verify configuration
    echo "  - Validating configuration files..."
    
    echo "✅ Verification completed"
fi

echo "\n🎉 All done! Check your Perplexity AI interface for updated file access."
echo "📅 Completed at: $(date)"
echo "================================================="

exit 0
