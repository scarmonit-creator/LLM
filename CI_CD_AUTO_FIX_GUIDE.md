# CI/CD Auto-Fix Guide

## Overview

This repository is configured with an automated CI/CD workflow that automatically fixes code quality issues and commits changes back to the repository. The workflow is implemented using GitHub Actions and runs on every push to main/develop branches and on pull requests.

## Workflow File Location

`.github/workflows/auto-fix.yml`

## Features

### 1. **Automated Code Quality Checks**
   - **Lint**: Runs ESLint to identify code quality issues
   - **Lint Fix**: Automatically fixes auto-fixable ESLint errors
   - **Format**: Runs Prettier to format code consistently
   - **Build**: Compiles TypeScript code using `tsc`
   - **Test**: Runs all tests using Node.js test runner

### 2. **Multi-Version Testing**
   The workflow tests against multiple Node.js versions:
   - Node.js 18.x
   - Node.js 20.x
   - Node.js 22.x

### 3. **Auto-Commit Functionality**
   - When the workflow runs on **push events** (to main or develop), it automatically commits any fixes back to the repository
   - Commits are made by `github-actions[bot]` user
   - Commit messages include `[skip ci]` tag to prevent infinite loops
   - Only commits from Node.js 20.x to avoid duplicate commits

### 4. **Pull Request Creation**
   - When the workflow runs on **pull request events**, it creates a new PR with the fixes instead of committing directly
   - Uses the `peter-evans/create-pull-request` action
   - PR includes:
     - Descriptive title: "Auto-fix: Apply lint, format, and build fixes"
     - Detailed body explaining the changes
     - Automatic labels: `automated`, `ci/cd`
     - Auto-delete branch on merge

### 5. **Manual Triggering**
   - The workflow can be manually triggered using the `workflow_dispatch` event
   - Go to Actions → Auto-Fix CI/CD → "Run workflow" button

## Workflow Triggers

The workflow runs on:
1. **Push to main or develop branch** - Auto-commits fixes
2. **Pull requests to main** - Creates a new PR with fixes
3. **Manual trigger** - Via GitHub Actions UI

## How It Works

### Step-by-Step Process

1. **Checkout Code**: Checks out the repository with full history
2. **Setup Node.js**: Installs the specified Node.js version with npm cache
3. **Install Dependencies**: Runs `npm ci` to install exact versions from package-lock.json
4. **Run Lint**: Executes `npm run lint` (with `--if-present || true` to continue on failure)
5. **Run Lint Fix**: Executes `npm run lint:fix` (if available)
6. **Run Format**: Executes `npm run format` to apply Prettier formatting
7. **Run Build**: Executes `npm run build` to compile TypeScript
8. **Run Tests**: Executes `npm test` to run all tests
9. **Check for Changes**: Uses `git status --porcelain` to detect if any files changed
10. **Commit and Push**: If changes detected and event is push, commits and pushes changes
11. **Create Pull Request**: If changes detected and event is pull_request, creates a new PR

## Configuration

### Required Scripts in package.json

The workflow expects the following npm scripts to be defined in `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --fix",
    "format": "prettier --write .",
    "build": "tsc",
    "test": "node --test"
  }
}
```

### Permissions

The workflow requires the following permissions:
- `contents: write` - To commit and push changes
- `pull-requests: write` - To create pull requests

These are configured in the workflow file:
```yaml
permissions:
  contents: write
  pull-requests: write
```

## Preventing Infinite Loops

The workflow uses `[skip ci]` in commit messages to prevent infinite loops. This tag tells GitHub Actions to skip running workflows on the auto-committed changes.

**Example commit message:**
```
Auto-fix: Apply lint, format, and build fixes [skip ci]
```

## Viewing Workflow Runs

1. Go to the **Actions** tab in the repository
2. Click on **Auto-Fix CI/CD** in the workflows list
3. View all workflow runs with their status, duration, and logs

## Manual Triggering

To manually trigger the workflow:

1. Go to **Actions** tab
2. Click **Auto-Fix CI/CD** in the left sidebar
3. Click **Run workflow** button
4. Select branch (default: main)
5. Click **Run workflow** to start

## Troubleshooting

### Workflow Not Running
- Check if the workflow file exists at `.github/workflows/auto-fix.yml`
- Verify the workflow is enabled in repository settings
- Check branch protection rules aren't blocking the workflow

### No Changes Committed
- The workflow only commits if there are actual changes after running lint/format/build
- Check workflow logs to see if changes were detected
- If no changes, the workflow completes successfully without committing

### Permission Errors
- Ensure the workflow has `contents: write` and `pull-requests: write` permissions
- Check repository settings under Actions → General → Workflow permissions
- Should be set to "Read and write permissions"

### Build Errors
- The workflow uses `|| true` to continue on failures
- Check individual job logs to see specific errors
- Fix errors in the codebase and push changes to trigger workflow again

## Best Practices

1. **Review Auto-Commits**: Always review auto-committed changes before deploying
2. **Test Locally First**: Run `npm run lint`, `npm run format`, and `npm run build` locally before pushing
3. **Keep Scripts Updated**: Ensure npm scripts in package.json are up to date
4. **Monitor Workflow Runs**: Regularly check Actions tab for failures or issues
5. **Update Dependencies**: Keep GitHub Actions dependencies up to date

## Example Workflow Runs

### Successful Run with Auto-Commit
```
✓ auto-fix (18.x) - 32s
✓ auto-fix (20.x) - 36s [COMMITTED CHANGES]
✓ auto-fix (22.x) - 34s

Commit: aea5298 - "Auto-fix: Apply lint, format, and build fixes [skip ci]"
By: github-actions[bot]
```

### Successful Run without Changes
```
✓ auto-fix (18.x) - 28s
✓ auto-fix (20.x) - 30s [NO CHANGES DETECTED]
✓ auto-fix (22.x) - 29s

No changes to commit.
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [peter-evans/create-pull-request Action](https://github.com/peter-evans/create-pull-request)
- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [TypeScript Compiler Options](https://www.typescriptlang.org/tsconfig)

## Maintenance

The workflow should be reviewed and updated periodically:
- Update Node.js versions as needed
- Update GitHub Actions versions (checkout, setup-node, etc.)
- Adjust workflow triggers based on repository needs
- Review and optimize workflow performance

## Support

For issues or questions about the CI/CD workflow:
1. Check the workflow logs in the Actions tab
2. Review this documentation
3. Open an issue in the repository with details about the problem

---

**Last Updated:** October 12, 2025
**Workflow Version:** 1.0.0
**Maintained By:** GitHub Actions Bot
