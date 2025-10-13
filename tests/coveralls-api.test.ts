/**
 * Tests for Coveralls API JSON-Format Web Data Integration
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  getRepo,
  getRepoBuilds,
  getAllRepoBuilds,
  getBuildById,
  getBuildByCommitSha,
  getBuildWithPaths,
  getJob,
  getJobWithPaths,
  getSourceFile,
  getSourceFileByName,
  analyzeSourceFile,
} from '../tools/coveralls-api';

// Use public Coveralls repo for testing (lemurheavy/coveralls-ruby)
const TEST_OWNER = 'lemurheavy';
const TEST_REPO = 'coveralls-ruby';
const TEST_SERVICE = 'github';
const TEST_BUILD_ID = 2885284;
const TEST_COMMIT_SHA = '2ea77ec5eeea2351de50b268994ba69f876b815c';
const TEST_JOB_ID = 6730283;
const TEST_FILE_ID = 880095615;
const TEST_FILENAME = 'lib/coveralls/simplecov.rb';

describe('Coveralls API Integration', () => {
  describe('Repository Operations', () => {
    it('should fetch repository data', async () => {
      const repo = await getRepo(TEST_OWNER, TEST_REPO, TEST_SERVICE);
      
      expect(repo).toBeDefined();
      expect(repo.repo_name).toBe(`${TEST_OWNER}/${TEST_REPO}`);
      expect(repo.covered_percent).toBeGreaterThanOrEqual(0);
      expect(repo.covered_percent).toBeLessThanOrEqual(100);
      expect(repo.commit_sha).toBeDefined();
      expect(repo.badge_url).toBeDefined();
    }, 15000);

    it('should fetch paginated builds', async () => {
      const builds = await getRepoBuilds(TEST_OWNER, TEST_REPO, 1, TEST_SERVICE);
      
      expect(builds).toBeDefined();
      expect(builds.page).toBe(1);
      expect(builds.pages).toBeGreaterThan(0);
      expect(builds.total).toBeGreaterThan(0);
      expect(builds.builds).toBeInstanceOf(Array);
      expect(builds.builds.length).toBeGreaterThan(0);
      expect(builds.builds.length).toBeLessThanOrEqual(10); // Coveralls returns 10 builds per page
    }, 15000);

    it('should fetch all builds across pages', async () => {
      const allBuilds = await getAllRepoBuilds(TEST_OWNER, TEST_REPO, TEST_SERVICE);
      
      expect(allBuilds).toBeDefined();
      expect(allBuilds).toBeInstanceOf(Array);
      expect(allBuilds.length).toBeGreaterThan(10); // Should have more than one page
      
      // Verify each build has required fields
      const firstBuild = allBuilds[0];
      expect(firstBuild.repo_name).toBe(`${TEST_OWNER}/${TEST_REPO}`);
      expect(firstBuild.commit_sha).toBeDefined();
      expect(firstBuild.covered_percent).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Build Operations', () => {
    it('should fetch build by ID', async () => {
      const build = await getBuildById(TEST_BUILD_ID);
      
      expect(build).toBeDefined();
      expect(build.repo_name).toBe(`${TEST_OWNER}/${TEST_REPO}`);
      expect(build.commit_sha).toBe(TEST_COMMIT_SHA);
      expect(build.covered_percent).toBeGreaterThanOrEqual(0);
      expect(build.branch).toBeDefined();
      expect(build.committer_name).toBeDefined();
    }, 15000);

    it('should fetch build by commit SHA', async () => {
      const build = await getBuildByCommitSha(TEST_COMMIT_SHA);
      
      expect(build).toBeDefined();
      expect(build.repo_name).toBe(`${TEST_OWNER}/${TEST_REPO}`);
      expect(build.commit_sha).toBe(TEST_COMMIT_SHA);
      expect(build.covered_percent).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should fetch build with specific paths (comma-separated)', async () => {
      const paths = 'lib/coveralls/simplecov.rb,lib/coveralls/configuration.rb';
      const build = await getBuildWithPaths(TEST_BUILD_ID, paths);
      
      expect(build).toBeDefined();
      expect(build.paths).toBe(paths);
      expect(build.selected_source_files_count).toBe(2);
      expect(build.paths_covered_percent).toBeDefined();
      expect(build.paths_covered_percent).toBeGreaterThanOrEqual(0);
      expect(build.paths_previous_covered_percent).toBeDefined();
      expect(build.paths_covered_percent_change).toBeDefined();
    }, 15000);

    it('should fetch build with glob pattern paths', async () => {
      const paths = 'lib/coveralls/*';
      const build = await getBuildWithPaths(TEST_COMMIT_SHA, paths);
      
      expect(build).toBeDefined();
      expect(build.paths).toBe(paths);
      expect(build.selected_source_files_count).toBeGreaterThan(2);
      expect(build.paths_covered_percent).toBeDefined();
      expect(build.paths_covered_percent).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Job Operations', () => {
    it('should fetch job data', async () => {
      const job = await getJob(TEST_JOB_ID);
      
      expect(job).toBeDefined();
      expect(job.repo_name).toBe(`${TEST_OWNER}/${TEST_REPO}`);
      expect(job.full_number).toBeDefined();
      expect(job.timestamp).toBeDefined();
      expect(job.covered_percent).toBeGreaterThanOrEqual(0);
      expect(job.covered_percent).toBeLessThanOrEqual(100);
    }, 15000);

    it('should fetch job with specific paths (comma-separated)', async () => {
      const paths = 'lib/coveralls/simplecov.rb,lib/coveralls/configuration.rb';
      const job = await getJobWithPaths(TEST_JOB_ID, paths);
      
      expect(job).toBeDefined();
      expect(job.paths).toBe(paths);
      expect(job.selected_source_files_count).toBe(2);
      expect(job.paths_covered_percent).toBeDefined();
      expect(job.paths_covered_percent).toBeGreaterThanOrEqual(0);
      expect(job.paths_previous_covered_percent).toBeDefined();
      expect(job.paths_covered_percent_change).toBeDefined();
    }, 15000);

    it('should fetch job with glob pattern paths', async () => {
      const paths = 'lib/coveralls/*';
      const job = await getJobWithPaths(TEST_JOB_ID, paths);
      
      expect(job).toBeDefined();
      expect(job.paths).toBe(paths);
      expect(job.selected_source_files_count).toBeGreaterThan(2);
      expect(job.paths_covered_percent).toBeDefined();
      expect(job.paths_covered_percent).toBeGreaterThanOrEqual(0);
    }, 15000);
  });

  describe('Source File Operations', () => {
    it('should fetch source file by ID', async () => {
      const sourceFile = await getSourceFile(TEST_FILE_ID);
      
      expect(sourceFile).toBeDefined();
      expect(sourceFile.coverage).toBeDefined();
      expect(sourceFile.coverage).toBeInstanceOf(Array);
      expect(sourceFile.coverage.length).toBeGreaterThan(0);
    }, 15000);

    it('should fetch source file by name', async () => {
      const sourceFile = await getSourceFileByName(TEST_BUILD_ID, TEST_FILENAME);
      
      expect(sourceFile).toBeDefined();
      expect(sourceFile.coverage).toBeDefined();
      expect(sourceFile.coverage).toBeInstanceOf(Array);
      expect(sourceFile.coverage.length).toBeGreaterThan(0);
    }, 15000);

    it('should fetch source file by name using commit SHA', async () => {
      const sourceFile = await getSourceFileByName(TEST_COMMIT_SHA, TEST_FILENAME);
      
      expect(sourceFile).toBeDefined();
      expect(sourceFile.coverage).toBeDefined();
      expect(sourceFile.coverage).toBeInstanceOf(Array);
      expect(sourceFile.coverage.length).toBeGreaterThan(0);
    }, 15000);

    it('should analyze source file coverage', async () => {
      const sourceFile = await getSourceFile(TEST_FILE_ID);
      const stats = analyzeSourceFile(sourceFile.coverage);
      
      expect(stats).toBeDefined();
      expect(stats.totalLines).toBeGreaterThan(0);
      expect(stats.relevantLines).toBeGreaterThan(0);
      expect(stats.relevantLines).toBeLessThanOrEqual(stats.totalLines);
      expect(stats.coveredLines).toBeGreaterThanOrEqual(0);
      expect(stats.uncoveredLines).toBeGreaterThanOrEqual(0);
      expect(stats.coveredLines + stats.uncoveredLines).toBe(stats.relevantLines);
      expect(stats.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(stats.coveragePercent).toBeLessThanOrEqual(100);
      expect(stats.linesByHitCount).toBeInstanceOf(Map);
      expect(stats.linesByHitCount.size).toBeGreaterThan(0);
    }, 15000);

    it('should correctly identify uncovered lines', async () => {
      const sourceFile = await getSourceFile(TEST_FILE_ID);
      const stats = analyzeSourceFile(sourceFile.coverage);
      
      // Check that we have uncovered lines (lines with 0 hits)
      const uncoveredLineNumbers = stats.linesByHitCount.get(0);
      if (uncoveredLineNumbers) {
        expect(uncoveredLineNumbers.length).toBe(stats.uncoveredLines);
        
        // Verify these line numbers are valid
        uncoveredLineNumbers.forEach(lineNum => {
          expect(lineNum).toBeGreaterThan(0);
          expect(lineNum).toBeLessThanOrEqual(stats.totalLines);
        });
      }
    }, 15000);
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid build ID gracefully', async () => {
      await expect(getBuildById(999999999)).rejects.toThrow();
    }, 15000);

    it('should handle invalid job ID gracefully', async () => {
      await expect(getJob(999999999)).rejects.toThrow();
    }, 15000);

    it('should handle invalid file ID gracefully', async () => {
      await expect(getSourceFile(999999999)).rejects.toThrow();
    }, 15000);

    it('should handle invalid commit SHA gracefully', async () => {
      await expect(getBuildByCommitSha('invalidsha123')).rejects.toThrow();
    }, 15000);

    it('should handle empty paths parameter', async () => {
      // Empty paths should still work but may return different results
      const build = await getBuildWithPaths(TEST_BUILD_ID, '');
      expect(build).toBeDefined();
    }, 15000);
  });

  describe('Data Integrity', () => {
    it('should return consistent data for same build accessed by ID and SHA', async () => {
      const buildById = await getBuildById(TEST_BUILD_ID);
      const buildBySha = await getBuildByCommitSha(TEST_COMMIT_SHA);
      
      expect(buildById.commit_sha).toBe(buildBySha.commit_sha);
      expect(buildById.covered_percent).toBe(buildBySha.covered_percent);
      expect(buildById.repo_name).toBe(buildBySha.repo_name);
    }, 15000);

    it('should return consistent coverage for same file accessed different ways', async () => {
      const fileById = await getSourceFile(TEST_FILE_ID);
      const fileByName = await getSourceFileByName(TEST_BUILD_ID, TEST_FILENAME);
      
      // The coverage arrays should be identical
      expect(fileById.coverage.length).toBe(fileByName.coverage.length);
      
      // Sample a few lines to verify they match
      for (let i = 0; i < Math.min(10, fileById.coverage.length); i++) {
        expect(fileById.coverage[i]).toBe(fileByName.coverage[i]);
      }
    }, 15000);
  });
});
