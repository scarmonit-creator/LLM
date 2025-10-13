#!/usr/bin/env python3
"""
MCP Server Model Configuration Fix Script

This script helps fix the 'Unsupported model' error by updating
model configuration in MCP server files.

Usage:
    python fix_mcp_model.py [path_to_mcp_server_directory]

Example:
    python fix_mcp_model.py C:\Users\scarm\.claude\mcp\servers\a2a-knowledge
"""

import os
import sys
import re
from pathlib import Path

# Model name mappings: invalid -> valid
MODEL_FIXES = {
    'gpt-5': 'gpt-4o',
    'gpt5': 'gpt-4o',
    'gpt-5-turbo': 'gpt-4o',
    'gpt5-turbo': 'gpt-4o',
}

# Valid model names for reference
VALID_MODELS = {
    'gpt': ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    'claude': ['claude-3-5-sonnet-20241022', 'claude-sonnet-4-5-20250929'],
    'gemini': ['gemini-1.5-pro', 'gemini-1.5-flash'],
    'ollama': ['llama3', 'llama2', 'mistral', 'codellama'],
}

def fix_model_in_file(file_path, dry_run=False):
    """
    Fix invalid model names in a file.
    
    Args:
        file_path: Path to the file to fix
        dry_run: If True, only report changes without modifying file
    
    Returns:
        True if changes were made, False otherwise
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes_made = []
        
        # Fix model names in the content
        for invalid, valid in MODEL_FIXES.items():
            # Pattern to match model assignments
            patterns = [
                # Python: model = "gpt-5" or MODEL="gpt-5"
                (rf'([Mm][Oo][Dd][Ee][Ll]\s*=\s*["\'])({invalid})(["\'])', rf'\g<1>{valid}\g<3>'),
                # Environment variables: export MODEL=gpt-5
                (rf'(export\s+[Mm][Oo][Dd][Ee][Ll]\s*=\s*)({invalid})(\s|$)', rf'\g<1>{valid}\g<3>'),
                # .env style: MODEL=gpt-5
                (rf'^([Mm][Oo][Dd][Ee][Ll]\s*=\s*)({invalid})(\s*$)', rf'\g<1>{valid}\g<3>', re.MULTILINE),
                # JSON: "model": "gpt-5"
                (rf'("model"\s*:\s*")({invalid})(")', rf'\g<1>{valid}\g<3>'),
            ]
            
            for pattern, replacement, *flags in patterns:
                flag = flags[0] if flags else 0
                new_content = re.sub(pattern, replacement, content, flags=flag)
                if new_content != content:
                    changes_made.append(f"{invalid} -> {valid}")
                    content = new_content
        
        if content != original_content:
            if not dry_run:
                # Backup original file
                backup_path = f"{file_path}.backup"
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(original_content)
                print(f"✓ Created backup: {backup_path}")
                
                # Write fixed content
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✓ Fixed {file_path}")
                for change in changes_made:
                    print(f"  - {change}")
            else:
                print(f"Would fix {file_path}:")
                for change in changes_made:
                    print(f"  - {change}")
            return True
        
        return False
    
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def scan_and_fix_directory(directory, dry_run=False):
    """
    Scan directory for files that might contain model configuration.
    
    Args:
        directory: Path to scan
        dry_run: If True, only report changes without modifying files
    """
    directory = Path(directory)
    
    if not directory.exists():
        print(f"Error: Directory does not exist: {directory}")
        return
    
    print(f"\nScanning: {directory}")
    print("="*60)
    
    # Files to check
    target_files = [
        'test_server.py',
        'server.py',
        'config.py',
        'config.json',
        '.env',
        '.env.local',
        'settings.py',
    ]
    
    fixed_count = 0
    
    for file_name in target_files:
        file_path = directory / file_name
        if file_path.exists():
            print(f"\nChecking: {file_name}")
            if fix_model_in_file(file_path, dry_run):
                fixed_count += 1
        else:
            print(f"Skipping: {file_name} (not found)")
    
    print("\n" + "="*60)
    if dry_run:
        print(f"\nDry run complete. Found {fixed_count} file(s) that need fixing.")
        print("Run without --dry-run to apply changes.")
    else:
        print(f"\nFixed {fixed_count} file(s).")
        if fixed_count > 0:
            print("\nNext steps:")
            print("1. Review the changes in the modified files")
            print("2. Restart your MCP server:")
            print(f"   cd {directory}")
            print("   python test_server.py")
            print("\n3. Verify no more 'Unsupported model' errors")

def print_valid_models():
    """Print list of valid model names."""
    print("\nValid Model Names:")
    print("="*60)
    for provider, models in VALID_MODELS.items():
        print(f"\n{provider.upper()}:")
        for model in models:
            print(f"  ✓ {model}")
    print("\n" + "="*60)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Fix invalid model names in MCP server configuration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Dry run (preview changes without applying)
  python fix_mcp_model.py --dry-run C:\\Users\\scarm\\.claude\\mcp\\servers\\a2a-knowledge
  
  # Apply fixes
  python fix_mcp_model.py C:\\Users\\scarm\\.claude\\mcp\\servers\\a2a-knowledge
  
  # Show valid model names
  python fix_mcp_model.py --list-models
''')
    
    parser.add_argument(
        'directory',
        nargs='?',
        help='Path to MCP server directory'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without modifying files'
    )
    
    parser.add_argument(
        '--list-models',
        action='store_true',
        help='Show list of valid model names'
    )
    
    args = parser.parse_args()
    
    if args.list_models:
        print_valid_models()
        return
    
    if not args.directory:
        parser.print_help()
        print("\nError: Please provide a directory path")
        print("\nCommon paths:")
        print("  C:\\Users\\scarm\\.claude\\mcp\\servers\\a2a-knowledge")
        sys.exit(1)
    
    scan_and_fix_directory(args.directory, args.dry_run)

if __name__ == '__main__':
    main()
