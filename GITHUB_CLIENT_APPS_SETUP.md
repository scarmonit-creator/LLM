# GitHub Client Apps Integration Guide

## Overview

This guide provides comprehensive setup and usage instructions for integrating with the LLM repository using GitHub's official client applications:

- **GitHub CLI (gh)**: Command-line interface for GitHub operations
- **GitHub Mobile**: iOS and Android mobile apps
- **GitHub Desktop**: GUI application for macOS and Windows

## GitHub CLI Integration

### Installation

#### macOS
```bash
brew install gh
```

#### Linux
```bash
# Debian/Ubuntu
sudo apt install gh

# Fedora/RHEL
sudo dnf install gh

# Arch Linux
sudo pacman -S github-cli
```

#### Windows
```powershell
winget install --id GitHub.cli
# OR using Chocolatey
choco install gh
```

### Authentication

1. **Authenticate with GitHub:**
```bash
gh auth login
```

2. **Select authentication method:**
   - Choose "GitHub.com"
   - Select "HTTPS" or "SSH"
   - Authenticate via browser or token

3. **Verify authentication:**
```bash
gh auth status
```

### Repository Operations

#### Clone the Repository
```bash
gh repo clone scarmonit-creator/LLM
cd LLM
```

#### Create and Manage Issues
```bash
# List issues
gh issue list

# Create a new issue
gh issue create --title "Issue title" --body "Issue description"

# View issue details
gh issue view <issue-number>

# Close an issue
gh issue close <issue-number>
```

#### Pull Request Management
```bash
# List pull requests
gh pr list

# Create a pull request
gh pr create --title "PR title" --body "PR description"

# Checkout a pull request locally
gh pr checkout <pr-number>

# Review a pull request
gh pr review <pr-number> --approve

# Merge a pull request
gh pr merge <pr-number>
```

#### Workflow Operations
```bash
# List workflows
gh workflow list

# View workflow runs
gh run list

# View workflow details
gh run view <run-id>

# Trigger a workflow
gh workflow run <workflow-name>

# Watch a workflow run
gh run watch
```

#### Repository Actions
```bash
# Fork the repository
gh repo fork

# View repository details
gh repo view

# Clone with all submodules
gh repo clone scarmonit-creator/LLM -- --recurse-submodules
```

### CI/CD Integration

The repository includes GitHub CLI integration in workflows:

```yaml
# Example workflow step using GitHub CLI
- name: Create Issue on Failure
  if: failure()
  run: |
    gh issue create \
      --title "CI Failed: ${{ github.workflow }}" \
      --body "Workflow run failed: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
      --label "ci-failure"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Automation Scripts

Create a `scripts/gh-cli-setup.sh` file for automated setup:

```bash
#!/bin/bash
# GitHub CLI Setup Script

set -e

echo "Setting up GitHub CLI for LLM repository..."

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI not found. Please install it first."
    echo "Visit: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "Not authenticated. Running gh auth login..."
    gh auth login
fi

# Clone repository if not already cloned
if [ ! -d "LLM" ]; then
    echo "Cloning repository..."
    gh repo clone scarmonit-creator/LLM
    cd LLM
else
    echo "Repository already cloned."
    cd LLM
fi

# Setup git hooks
if [ -d ".git" ]; then
    echo "Setting up git hooks..."
    # Add pre-commit hooks here if needed
fi

# Install dependencies
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "GitHub CLI setup complete!"
echo "Try: gh issue list"
```

## GitHub Mobile Integration

### Installation

- **iOS**: [Download from App Store](https://apps.apple.com/app/github/id1477376905)
- **Android**: [Download from Google Play](https://play.google.com/store/apps/details?id=com.github.android)

### Features

#### Repository Management
- Browse repository files and folders
- View and search code
- Read and edit Markdown files
- View commit history
- Star and watch repositories

#### Issue Management
- Create, edit, and close issues
- Add labels and assignees
- Comment on issues
- Filter and search issues
- Receive push notifications

#### Pull Request Management
- Review pull requests
- Add comments and reviews
- Approve or request changes
- Merge pull requests
- View diffs and commit details

#### Notifications
- Real-time push notifications
- Customize notification preferences
- Mark notifications as read
- Respond to mentions and comments

### Mobile-Optimized Files

The repository includes mobile-friendly documentation:

- `README.md`: Mobile-optimized formatting
- Issue templates: Simplified for mobile use
- PR templates: Concise and mobile-friendly

### Mobile Workflow

1. **Quick Issue Creation**: Use mobile app to create issues on-the-go
2. **Code Review**: Review PRs during commute
3. **Notification Management**: Stay updated with push notifications
4. **Quick Merges**: Approve and merge PRs from mobile

## GitHub Desktop Integration

### Installation

- **Download**: [desktop.github.com](https://desktop.github.com/)
- **Platforms**: macOS, Windows

### Setup

1. **Install GitHub Desktop**
2. **Sign in to GitHub.com**
3. **Clone the Repository**:
   - File → Clone Repository
   - Search for "scarmonit-creator/LLM"
   - Choose local path
   - Click "Clone"

### Features

#### Visual Git Operations
- View diffs with syntax highlighting
- Stage changes visually
- Commit with descriptive messages
- Push and pull with one click
- Manage branches graphically

#### Branch Management
- Create new branches
- Switch between branches
- Merge branches
- Delete branches
- View branch history

#### Conflict Resolution
- Visual merge conflict resolution
- Side-by-side diff view
- Choose changes interactively

#### Integration Features
- Open in preferred text editor
- Open in terminal/command prompt
- View on GitHub.com
- Create pull requests

### Desktop Configuration

Create a `.github/desktop.json` configuration file:

```json
{
  "defaultBranch": "main",
  "commitMessageTemplate": "{{type}}: {{description}}\n\n{{body}}",
  "pullRequestTemplate": ".github/pull_request_template.md",
  "ignorePatterns": [
    "node_modules/",
    "dist/",
    ".env",
    "*.log"
  ]
}
```

### Recommended Workflow

1. **Fetch Origin**: Keep repository up-to-date
2. **Create Branch**: For each feature/fix
3. **Make Changes**: Edit files in preferred editor
4. **Review Changes**: Use Desktop's diff view
5. **Commit**: Write descriptive commit messages
6. **Push**: Push changes to GitHub
7. **Create PR**: Via Desktop or web interface

## Integration Testing

### GitHub CLI Tests

```bash
# Test authentication
gh auth status

# Test repository access
gh repo view scarmonit-creator/LLM

# Test issue operations
gh issue list --limit 5

# Test workflow access
gh workflow list
```

### Mobile App Tests

1. ✅ Open repository in mobile app
2. ✅ Browse files and code
3. ✅ View and create issues
4. ✅ Review pull requests
5. ✅ Receive notifications

### Desktop App Tests

1. ✅ Clone repository
2. ✅ Create and switch branches
3. ✅ Make and commit changes
4. ✅ Push to remote
5. ✅ Create pull request

## Troubleshooting

### GitHub CLI

**Problem**: `gh: command not found`
- **Solution**: Install GitHub CLI using package manager

**Problem**: Authentication failed
- **Solution**: Run `gh auth refresh` or `gh auth login` again

**Problem**: Permission denied
- **Solution**: Verify token has required scopes: `gh auth refresh -s repo,workflow`

### GitHub Mobile

**Problem**: Repository not visible
- **Solution**: Check repository privacy settings and app permissions

**Problem**: Push notifications not working
- **Solution**: Enable notifications in device settings and GitHub app settings

### GitHub Desktop

**Problem**: Authentication failed
- **Solution**: Sign out and sign in again in Desktop preferences

**Problem**: Push failed
- **Solution**: Check internet connection and GitHub status page

**Problem**: Merge conflicts
- **Solution**: Use Desktop's visual conflict resolution tool or resolve in text editor

## Best Practices

### Security

1. **Use SSH Keys**: More secure than HTTPS
2. **Token Management**: Store tokens securely, rotate regularly
3. **Two-Factor Authentication**: Enable 2FA on GitHub account
4. **Scope Limitation**: Grant minimal required permissions

### Workflow

1. **Consistent Branching**: Use descriptive branch names
2. **Atomic Commits**: Small, focused commits
3. **Descriptive Messages**: Clear commit messages
4. **Regular Pulls**: Stay updated with main branch
5. **Code Review**: Review before merging

### Collaboration

1. **Issue Templates**: Use provided templates
2. **PR Templates**: Follow PR checklist
3. **Labels**: Apply appropriate labels
4. **Assignees**: Assign relevant team members
5. **Milestones**: Track progress with milestones

## Additional Resources

- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GitHub Mobile Docs](https://docs.github.com/en/get-started/using-github/github-mobile)
- [GitHub Desktop Docs](https://docs.github.com/en/desktop)
- [GitHub API Documentation](https://docs.github.com/en/rest)

## Support

For issues or questions:

1. Check this guide
2. Search existing issues
3. Create a new issue with "client-app" label
4. Contact repository maintainers

---

**Last Updated**: October 2025
**Maintainer**: scarmonit-creator
**Repository**: https://github.com/scarmonit-creator/LLM
