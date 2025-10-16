#!/bin/bash

# Comprehensive Repository Validation Suite
# Runs multiple validation tasks in parallel for maximum efficiency

set -euo pipefail

echo "🚀 Repository Validation Suite - Parallel Execution Mode"
echo "============================================================"

START_TIME=$(date +%s)
VALIDATION_DIR="validation-results"
mkdir -p "$VALIDATION_DIR"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to run tasks in parallel
run_parallel_tasks() {
    local pids=()
    
    # Task 1: Quick repository test
    (
        log_info "Running quick repository test..."
        node quick-test.js > "$VALIDATION_DIR/quick-test.log" 2>&1
        echo $? > "$VALIDATION_DIR/quick-test.exit"
    ) &
    pids+=($!)
    
    # Task 2: Dependencies check
    (
        log_info "Checking dependencies..."
        npm audit --audit-level=high > "$VALIDATION_DIR/audit.log" 2>&1
        echo $? > "$VALIDATION_DIR/audit.exit"
    ) &
    pids+=($!)
    
    # Task 3: Performance optimizer test
    (
        log_info "Testing performance optimizer..."
        timeout 30s node scripts/performance-optimizer.js > "$VALIDATION_DIR/perf-optimizer.log" 2>&1
        echo $? > "$VALIDATION_DIR/perf-optimizer.exit"
    ) &
    pids+=($!)
    
    # Task 4: Bridge demo test
    (
        log_info "Testing bridge demo..."
        timeout 25s node examples/bridge-demo.js > "$VALIDATION_DIR/bridge-demo.log" 2>&1 
        echo $? > "$VALIDATION_DIR/bridge-demo.exit"
    ) &
    pids+=($!)
    
    # Task 5: Ultra bridge demo test
    (
        log_info "Testing ultra bridge demo..."
        timeout 35s node examples/bridge-demo-ultra.js > "$VALIDATION_DIR/bridge-ultra.log" 2>&1
        echo $? > "$VALIDATION_DIR/bridge-ultra.exit"
    ) &
    pids+=($!)
    
    # Wait for all parallel tasks to complete
    log_info "Waiting for parallel validation tasks to complete..."
    for pid in "${pids[@]}"; do
        wait $pid
    done
}

# Function to analyze results
analyze_results() {
    local passed=0
    local failed=0
    local total=0
    
    log_section "VALIDATION RESULTS ANALYSIS"
    
    # Check each test result
    for test in quick-test audit perf-optimizer bridge-demo bridge-ultra; do
        ((total++))
        if [ -f "$VALIDATION_DIR/${test}.exit" ]; then
            exit_code=$(cat "$VALIDATION_DIR/${test}.exit")
            if [ $exit_code -eq 0 ]; then
                log_info "✅ $test: PASSED"
                ((passed++))
            else
                log_error "❌ $test: FAILED (exit code: $exit_code)"
                ((failed++))
                
                # Show error details
                if [ -f "$VALIDATION_DIR/${test}.log" ]; then
                    echo "   Error details:"
                    tail -n 3 "$VALIDATION_DIR/${test}.log" | sed 's/^/   /'
                fi
            fi
        else
            log_warn "⚠️ $test: NO RESULT FILE"
            ((failed++))
        fi
    done
    
    # Calculate health score
    local health_score=$(( passed * 100 / total ))
    
    log_section "SUMMARY"
    echo "Total Tests: $total"
    echo "Passed: $passed"
    echo "Failed: $failed"
    echo "Health Score: $health_score%"
    
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    echo "Total Duration: ${duration}s"
    
    # Determine overall status
    if [ $health_score -ge 80 ]; then
        log_info "🎆 REPOSITORY STATUS: EXCELLENT - Ready for production!"
        return 0
    elif [ $health_score -ge 60 ]; then
        log_warn "✅ REPOSITORY STATUS: GOOD - Minor issues need attention"
        return 0
    else
        log_error "⚠️ REPOSITORY STATUS: NEEDS IMPROVEMENT - Critical issues found"
        return 1
    fi
}

# Main execution
main() {
    log_section "ENVIRONMENT SETUP"
    
    # Check Node.js version
    node_version=$(node --version)
    log_info "Node.js version: $node_version"
    
    # Check npm version
    npm_version=$(npm --version)
    log_info "npm version: $npm_version"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci --prefer-offline --no-audit || npm install --no-audit
    else
        log_info "Dependencies already installed"
    fi
    
    log_section "PARALLEL VALIDATION EXECUTION"
    
    # Run all tests in parallel
    run_parallel_tasks
    
    # Analyze and report results
    if analyze_results; then
        log_info "🎉 Validation suite completed successfully!"
        exit 0
    else
        log_error "🚨 Validation suite found issues that need attention"
        exit 1
    fi
}

# Handle script interruption
trap 'log_error "Validation interrupted"; exit 1' INT TERM

# Execute main function
main
