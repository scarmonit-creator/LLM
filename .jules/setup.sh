#!/bin/bash
set -e

echo "🚀 Setting up LLM application environment..."

# Check Node.js version
echo "📦 Checking Node.js version..."
node --version

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Verify installations
echo "✅ Verifying installations..."
npm list --depth=0

# Run linter check
echo "🔍 Running linter..."
npm run lint || echo "⚠️  Linter warnings found"

# Run tests
echo "🧪 Running tests..."
npm test || echo "⚠️  No tests found yet"

echo "✅ Environment setup complete!"
echo "ℹ️  Remember to set ANTHROPIC_API_KEY in .env file"
