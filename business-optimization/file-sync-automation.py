#!/usr/bin/env python3
"""
Perplexity File Synchronization Automation Script
Automatically optimizes and syncs business files with Perplexity AI
"""

import os
import json
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('file_sync.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class PerplexityFileOptimizer:
    """Optimizes and manages business files for Perplexity AI integration"""
    
    def __init__(self, repo_path: str = "."):
        self.repo_path = Path(repo_path)
        self.config_path = self.repo_path / "business-optimization" / "sync-config.json"
        self.manifest_path = self.repo_path / "business-optimization" / "file-manifest.json"
        
        # Priority file patterns
        self.priority_patterns = [
            "*.md",          # Documentation
            "*.json",        # Configuration
            "*.js", "*.ts",  # Code files
            "*.py",          # Python scripts
            "README*",       # README files
            "*config*",      # Config files
        ]
        
        # Files to exclude
        self.exclude_patterns = [
            "node_modules/*",
            ".git/*",
            "*.log",
            "package-lock.json",
            "*.tmp"
        ]
    
    def scan_repository(self) -> Dict[str, Any]:
        """Scan repository for business-critical files"""
        logger.info("Scanning repository for business files...")
        
        file_inventory = {
            "scan_date": datetime.now().isoformat(),
            "total_files": 0,
            "priority_files": [],
            "categories": {
                "documentation": [],
                "configuration": [],
                "automation": [],
                "business_logic": []
            },
            "file_hashes": {}
        }
        
        for file_path in self.repo_path.rglob("*"):
            if file_path.is_file() and not self._should_exclude(file_path):
                file_inventory["total_files"] += 1
                
                # Calculate file hash for change detection
                file_hash = self._calculate_file_hash(file_path)
                rel_path = str(file_path.relative_to(self.repo_path))
                file_inventory["file_hashes"][rel_path] = file_hash
                
                # Categorize files
                category = self._categorize_file(file_path)
                if category:
                    file_inventory["categories"][category].append(rel_path)
                
                # Check if priority file
                if self._is_priority_file(file_path):
                    file_inventory["priority_files"].append({
                        "path": rel_path,
                        "size": file_path.stat().st_size,
                        "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                        "category": category,
                        "hash": file_hash
                    })
        
        logger.info(f"Found {file_inventory['total_files']} total files, {len(file_inventory['priority_files'])} priority files")
        return file_inventory
    
    def _should_exclude(self, file_path: Path) -> bool:
        """Check if file should be excluded from processing"""
        rel_path = str(file_path.relative_to(self.repo_path))
        
        for pattern in self.exclude_patterns:
            if file_path.match(pattern) or rel_path.startswith(pattern.replace("/*", "")):
                return True
        return False
    
    def _is_priority_file(self, file_path: Path) -> bool:
        """Check if file matches priority patterns"""
        for pattern in self.priority_patterns:
            if file_path.match(pattern):
                return True
        return False
    
    def _categorize_file(self, file_path: Path) -> str:
        """Categorize file based on its purpose"""
        name_lower = file_path.name.lower()
        
        if file_path.suffix == ".md":
            return "documentation"
        elif file_path.suffix in [".json", ".js", ".ts"] and "config" in name_lower:
            return "configuration"
        elif "automation" in name_lower or "ci" in name_lower or "workflow" in name_lower:
            return "automation"
        elif file_path.suffix in [".py", ".js", ".ts"]:
            return "business_logic"
        
        return None
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file content"""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception as e:
            logger.warning(f"Could not hash {file_path}: {e}")
            return ""
    
    def detect_changes(self, current_inventory: Dict[str, Any]) -> Dict[str, List[str]]:
        """Detect changed files since last scan"""
        if not self.manifest_path.exists():
            logger.info("No previous manifest found, treating all files as new")
            return {
                "new": list(current_inventory["file_hashes"].keys()),
                "modified": [],
                "deleted": []
            }
        
        with open(self.manifest_path, 'r') as f:
            previous_inventory = json.load(f)
        
        previous_hashes = previous_inventory.get("file_hashes", {})
        current_hashes = current_inventory["file_hashes"]
        
        changes = {
            "new": [],
            "modified": [],
            "deleted": []
        }
        
        # Find new and modified files
        for file_path, current_hash in current_hashes.items():
            if file_path not in previous_hashes:
                changes["new"].append(file_path)
            elif previous_hashes[file_path] != current_hash:
                changes["modified"].append(file_path)
        
        # Find deleted files
        for file_path in previous_hashes:
            if file_path not in current_hashes:
                changes["deleted"].append(file_path)
        
        logger.info(f"Changes detected - New: {len(changes['new'])}, Modified: {len(changes['modified'])}, Deleted: {len(changes['deleted'])}")
        return changes
    
    def save_manifest(self, inventory: Dict[str, Any]):
        """Save file inventory to manifest file"""
        os.makedirs(self.manifest_path.parent, exist_ok=True)
        
        with open(self.manifest_path, 'w') as f:
            json.dump(inventory, f, indent=2)
        
        logger.info(f"Manifest saved to {self.manifest_path}")
    
    def generate_optimization_report(self, inventory: Dict[str, Any], changes: Dict[str, List[str]]) -> str:
        """Generate optimization report"""
        report = f"""
# Perplexity File Optimization Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary
- Total Files Scanned: {inventory['total_files']}
- Priority Files: {len(inventory['priority_files'])}
- Changes Detected: {len(changes['new']) + len(changes['modified']) + len(changes['deleted'])}

## File Categories
"""
        
        for category, files in inventory["categories"].items():
            if files:
                report += f"\n### {category.replace('_', ' ').title()}
"
                for file in files[:10]:  # Show first 10 files
                    report += f"- {file}\n"
                if len(files) > 10:
                    report += f"... and {len(files) - 10} more files\n"
        
        report += "\n## Recent Changes\n"
        if changes["new"]:
            report += f"\n### New Files ({len(changes['new'])})\n"
            for file in changes["new"][:5]:
                report += f"- {file}\n"
        
        if changes["modified"]:
            report += f"\n### Modified Files ({len(changes['modified'])})\n"
            for file in changes["modified"][:5]:
                report += f"- {file}\n"
        
        report += "\n## Recommendations\n"
        report += "1. Ensure GitHub connector is syncing these priority files\n"
        report += "2. Monitor file changes for automated updates\n"
        report += "3. Consider automated file tagging for improved search\n"
        
        return report
    
    def run_optimization(self) -> Dict[str, Any]:
        """Run complete file optimization process"""
        logger.info("Starting Perplexity file optimization...")
        
        try:
            # Scan repository
            inventory = self.scan_repository()
            
            # Detect changes
            changes = self.detect_changes(inventory)
            
            # Save manifest
            self.save_manifest(inventory)
            
            # Generate report
            report = self.generate_optimization_report(inventory, changes)
            
            # Save report
            report_path = self.repo_path / "business-optimization" / "optimization-report.md"
            os.makedirs(report_path.parent, exist_ok=True)
            
            with open(report_path, 'w') as f:
                f.write(report)
            
            logger.info(f"Optimization complete! Report saved to {report_path}")
            
            return {
                "status": "success",
                "inventory": inventory,
                "changes": changes,
                "report_path": str(report_path)
            }
            
        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

def main():
    """Main execution function"""
    optimizer = PerplexityFileOptimizer()
    result = optimizer.run_optimization()
    
    if result["status"] == "success":
        print("\n✅ File optimization completed successfully!")
        print(f"📊 Total files: {result['inventory']['total_files']}")
        print(f"⭐ Priority files: {len(result['inventory']['priority_files'])}")
        print(f"📝 Report: {result['report_path']}")
    else:
        print(f"\n❌ Optimization failed: {result['error']}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
