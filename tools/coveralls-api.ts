/**
 * Coveralls API JSON-Format Web Data Integration
 *
 * This tool provides functionality to fetch and process coverage data from Coveralls
 * using the JSON-format web data API. It supports fetching data for:
 * - Repositories
 * - Builds
 * - Jobs
 * - Source files
 *
 * All endpoints require authentication via OAuth (user must be logged in to Coveralls web app)
 * and support the .json suffix to return JSON representations.
 */

export interface CoverallsRepoData {
  created_at: string;
  url: string | null;
  commit_message: string;
  branch: string;
  committer_name: string;
  committer_email: string;
  commit_sha: string;
  repo_name: string;
  badge_url: string;
  coverage_change: number;
  covered_percent: number;
}

export interface CoverallsRepoBuildsData {
  page: number;
  pages: number;
  total: number;
  builds: CoverallsRepoData[];
}

export interface CoverallsBuildData {
  created_at: string;
  url: string | null;
  commit_message: string;
  branch: string;
  committer_name: string;
  committer_email: string;
  commit_sha: string;
  repo_name: string;
  badge_url: string;
  coverage_change: number;
  covered_percent: number;
  covered_lines: number;
  total_lines: number;
}

export interface CoverallsJobData {
  created_at: string;
  run_at: string;
  job_id: string;
  coverage_change: number;
  covered_percent: number;
  source_files?: Array<{
    name: string;
    coverage: (number | null)[];
  }>;
  paths?: string[];
}

export class CoverallsAPI {
  private baseUrl = 'https://coveralls.io';

  /**
   * Constructs the API URL for a repository
   */
  private getRepoUrl(service: string, username: string, repo: string): string {
    return `${this.baseUrl}/${service}/${username}/${repo}.json`;
  }

  /**
   * Constructs the API URL for repository builds
   */
  private getRepoBuildsUrl(
    service: string,
    username: string,
    repo: string,
    page: number = 1,
  ): string {
    return `${this.baseUrl}/builds/${service}/${username}/${repo}.json?page=${page}`;
  }

  /**
   * Fetches repository data from Coveralls
   */
  async getRepo(
    service: string,
    username: string,
    repo: string,
  ): Promise<CoverallsRepoData> {
    const url = this.getRepoUrl(service, username, repo);
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch repo data: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsRepoData;
  }

  /**
   * Fetches paginated builds data for a repository
   */
  async getRepoBuilds(
    service: string,
    username: string,
    repo: string,
    page: number = 1,
  ): Promise<CoverallsRepoBuildsData> {
    const url = this.getRepoBuildsUrl(service, username, repo, page);
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch repo builds: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsRepoBuildsData;
  }

  /**
   * Fetches build data by build ID
   */
  async getBuild(buildId: string): Promise<CoverallsBuildData> {
    const url = `${this.baseUrl}/builds/${buildId}.json`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch build data: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsBuildData;
  }

  /**
   * Fetches build data by commit SHA
   */
  async getBuildByCommit(
    service: string,
    username: string,
    repo: string,
    commitSha: string,
  ): Promise<CoverallsBuildData> {
    const url = `${this.baseUrl}/builds/${service}/${username}/${repo}/${commitSha}.json`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch build by commit: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsBuildData;
  }

  /**
   * Fetches build data by branch name
   */
  async getBuildByBranch(
    service: string,
    username: string,
    repo: string,
    branch: string,
  ): Promise<CoverallsBuildData> {
    const url = `${this.baseUrl}/${service}/${username}/${repo}/${branch}.json`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch build by branch: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsBuildData;
  }

  /**
   * Fetches job data by job ID
   */
  async getJob(jobId: string): Promise<CoverallsJobData> {
    const url = `${this.baseUrl}/jobs/${jobId}.json`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch job data: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsJobData;
  }

  /**
   * Fetches job data with paths field included
   */
  async getJobWithPaths(jobId: string): Promise<CoverallsJobData> {
    const url = `${this.baseUrl}/jobs/${jobId}.json?paths=true`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch job with paths: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CoverallsJobData;
  }

  /**
   * Fetches source file coverage data for a specific job
   */
  async getSourceFile(
    jobId: string,
    filePath: string,
  ): Promise<(number | null)[]> {
    const encodedPath = encodeURIComponent(filePath);
    const url = `${this.baseUrl}/jobs/${jobId}/source.json?filename=${encodedPath}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch source file: ${response.status} ${response.statusText}`,
      );
    }

    const coverage = (await response.json()) as (number | null)[];
    return coverage;
  }

  /**
   * Fetches source file coverage data for a specific build
   */
  async getSourceFileByBuild(
    buildId: string,
    filePath: string,
  ): Promise<(number | null)[]> {
    const encodedPath = encodeURIComponent(filePath);
    const url = `${this.baseUrl}/builds/${buildId}/source.json?filename=${encodedPath}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch source file by build: ${response.status} ${response.statusText}`,
      );
    }

    const coverage = (await response.json()) as (number | null)[];
    return coverage;
  }
}

export default CoverallsAPI;
