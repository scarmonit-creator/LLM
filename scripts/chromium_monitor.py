#!/usr/bin/env python3
"""
Autonomous Chromium Repository Monitor
Implements real-time monitoring and analysis of Chromium repositories
Based on selected text analysis from Chromium Code Search
"""

import json
import time
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('chromium_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class Repository:
    name: str
    url: str
    language: str
    license: str
    priority: str
    last_checked: Optional[datetime] = None
    commit_frequency: int = 0
    alert_threshold: int = 5

class ChromiumMonitor:
    """Autonomous monitoring system for Chromium repositories"""
    
    def __init__(self):
        self.repositories = self._load_repository_config()
        self.alerts_enabled = True
        self.monitoring_active = False
        
    def _load_repository_config(self) -> List[Repository]:
        """Load repository configuration from analysis data"""
        try:
            with open('analysis/chromium_repositories_analysis.json', 'r') as f:
                data = json.load(f)
            
            repos = []
            for repo_data in data['repositories']:
                repo = Repository(
                    name=repo_data['name'],
                    url=repo_data['url'],
                    language=repo_data['primary_language'],
                    license=repo_data['license'],
                    priority=repo_data['priority']
                )
                
                # Set alert thresholds based on priority
                if repo.priority == 'critical':
                    repo.alert_threshold = 20  # Alert if >20 commits/hour
                elif repo.priority == 'high':
                    repo.alert_threshold = 10
                else:
                    repo.alert_threshold = 5
                    
                repos.append(repo)
            
            logger.info(f"Loaded {len(repos)} repositories for monitoring")
            return repos
            
        except FileNotFoundError:
            logger.error("Repository analysis file not found")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in analysis file: {e}")
            return []
    
    def start_monitoring(self, interval_minutes: int = 15):
        """Start autonomous monitoring of all repositories"""
        logger.info("Starting autonomous Chromium repository monitoring")
        self.monitoring_active = True
        
        while self.monitoring_active:
            try:
                self._monitor_cycle()
                time.sleep(interval_minutes * 60)
            except KeyboardInterrupt:
                logger.info("Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    
    def _monitor_cycle(self):
        """Execute one monitoring cycle for all repositories"""
        logger.info("Executing monitoring cycle")
        
        for repo in self.repositories:
            try:
                self._check_repository(repo)
            except Exception as e:
                logger.error(f"Error checking {repo.name}: {e}")
        
        self._generate_status_report()
    
    def _check_repository(self, repo: Repository):
        """Check individual repository for activity"""
        logger.debug(f"Checking repository: {repo.name}")
        
        # Simulate API call to check commits (replace with actual API)
        activity_data = self._fetch_repository_activity(repo)
        
        if activity_data:
            repo.commit_frequency = activity_data.get('commits_last_hour', 0)
            repo.last_checked = datetime.now()
            
            # Check for alerts
            if repo.commit_frequency > repo.alert_threshold:
                self._trigger_alert(repo, 'high_activity')
            
            # Log activity
            logger.info(
                f"{repo.name}: {repo.commit_frequency} commits/hour "
                f"(threshold: {repo.alert_threshold})"
            )
    
    def _fetch_repository_activity(self, repo: Repository) -> Dict:
        """Fetch repository activity data (simulated)"""
        # In a real implementation, this would use the Chromium API
        # For now, simulate based on repository priority
        
        import random
        
        if repo.priority == 'critical':
            commits = random.randint(15, 30)  # High activity for chromium/src
        elif repo.priority == 'high':
            commits = random.randint(5, 15)
        else:
            commits = random.randint(1, 8)
        
        return {
            'commits_last_hour': commits,
            'active_branches': random.randint(10, 50),
            'contributors_active': random.randint(5, 20)
        }
    
    def _trigger_alert(self, repo: Repository, alert_type: str):
        """Trigger monitoring alert"""
        if not self.alerts_enabled:
            return
        
        alert_message = (
            f"ALERT: {alert_type.upper()} detected in {repo.name}\n"
            f"Commit frequency: {repo.commit_frequency}/hour\n"
            f"Threshold: {repo.alert_threshold}/hour\n"
            f"Priority: {repo.priority}\n"
            f"Time: {datetime.now().isoformat()}"
        )
        
        logger.warning(alert_message)
        
        # Save alert to file
        self._save_alert(repo, alert_type, alert_message)
    
    def _save_alert(self, repo: Repository, alert_type: str, message: str):
        """Save alert to alerts log file"""
        alert_data = {
            'timestamp': datetime.now().isoformat(),
            'repository': repo.name,
            'alert_type': alert_type,
            'message': message,
            'commit_frequency': repo.commit_frequency,
            'threshold': repo.alert_threshold
        }
        
        try:
            with open('alerts/chromium_alerts.jsonl', 'a') as f:
                f.write(json.dumps(alert_data) + '\n')
        except FileNotFoundError:
            # Create alerts directory if it doesn't exist
            import os
            os.makedirs('alerts', exist_ok=True)
            with open('alerts/chromium_alerts.jsonl', 'w') as f:
                f.write(json.dumps(alert_data) + '\n')
    
    def _generate_status_report(self):
        """Generate and save monitoring status report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'monitoring_active': self.monitoring_active,
            'repositories_monitored': len(self.repositories),
            'repositories': []
        }
        
        for repo in self.repositories:
            repo_status = {
                'name': repo.name,
                'priority': repo.priority,
                'last_checked': repo.last_checked.isoformat() if repo.last_checked else None,
                'commit_frequency': repo.commit_frequency,
                'alert_threshold': repo.alert_threshold,
                'status': 'normal' if repo.commit_frequency <= repo.alert_threshold else 'elevated'
            }
            report['repositories'].append(repo_status)
        
        # Save report
        with open('reports/chromium_status.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Status report generated: {len(self.repositories)} repositories")
    
    def stop_monitoring(self):
        """Stop autonomous monitoring"""
        self.monitoring_active = False
        logger.info("Monitoring stopped")
    
    def get_summary(self) -> Dict:
        """Get current monitoring summary"""
        active_repos = [r for r in self.repositories if r.last_checked]
        high_activity = [r for r in active_repos if r.commit_frequency > r.alert_threshold]
        
        return {
            'total_repositories': len(self.repositories),
            'actively_monitored': len(active_repos),
            'high_activity_repos': len(high_activity),
            'alerts_enabled': self.alerts_enabled,
            'monitoring_active': self.monitoring_active,
            'last_update': datetime.now().isoformat()
        }

def main():
    """Main execution function for autonomous operation"""
    logger.info("Starting Autonomous Chromium Repository Monitor")
    
    # Create necessary directories
    import os
    os.makedirs('reports', exist_ok=True)
    os.makedirs('alerts', exist_ok=True)
    
    # Initialize and start monitoring
    monitor = ChromiumMonitor()
    
    if not monitor.repositories:
        logger.error("No repositories loaded. Check analysis file.")
        return
    
    try:
        # Run one immediate check
        monitor._monitor_cycle()
        
        # Display summary
        summary = monitor.get_summary()
        logger.info(f"Monitoring Summary: {json.dumps(summary, indent=2)}")
        
        # Start continuous monitoring (comment out for single run)
        # monitor.start_monitoring(interval_minutes=15)
        
    except Exception as e:
        logger.error(f"Monitor execution failed: {e}")
        raise

if __name__ == "__main__":
    main()
