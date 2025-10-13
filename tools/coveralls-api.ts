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
  paths?: string;
  selected_source_files_count?: number;
  paths_covered_percent?: number;
  paths_previous_covered_percent?: number;
  paths_covered_percent_change?: number;
}

export interface CoverallsJobData {
  repo_name: string;
  full_number: string;
  timestamp: string;
  covered_percent: number;
}

export type CoverallsSourceFileData = (number | null)[];

export interface CoverallsApiOptions {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}

export class CoverallsApiClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;

  constructor(options: CoverallsApiOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://coveralls.io';
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
  }

  /**
   * Fetch JSON data from a Coveralls URL
   */
  private async fetchWithRetry(url: string, attempt = 1): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < this.retryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Fetch repository data
   * @param service - git service (e.g., 'github', 'gitlab')
   * @param owner - repository owner
   * @param repo - repository name
   */
  async getRepo(service: string, owner: string, repo: string): Promise<CoverallsRepoData> {
    const url = `${this.baseUrl}/${service}/${owner}/${repo}.json`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch paginated builds for a repository
   * @param service - git service (e.g., 'github', 'gitlab')
   * @param owner - repository owner
   * @param repo - repository name
   * @param page - page number (default: 1)
   */
  async getRepoBuilds(
    service: string,
    owner: string,
    repo: string,
    page = 1
  ): Promise<CoverallsRepoBuildsData> {
    const url = `${this.baseUrl}/${service}/${owner}/${repo}.json?page=${page}`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch build data by build ID
   * @param buildId - numeric build ID
   */
  async getBuildById(buildId: number): Promise<CoverallsBuildData> {
    const url = `${this.baseUrl}/builds/${buildId}.json`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch build data by commit SHA
   * @param commitSha - git commit SHA
   */
  async getBuildByCommitSha(commitSha: string): Promise<CoverallsBuildData> {
    const url = `${this.baseUrl}/builds/${commitSha}.json`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch build data with path filters
   * @param buildId - numeric build ID or commit SHA
   * @param paths - comma-separated paths or glob patterns
   */
  async getBuildWithPaths(buildId: number | string, paths: string): Promise<CoverallsBuildData> {
    const url = `${this.baseUrl}/builds/${buildId}.json?paths=${encodeURIComponent(paths)}`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch job data
   * @param jobId - numeric job ID
   */
  async getJob(jobId: number): Promise<CoverallsJobData> {
    const url = `${this.baseUrl}/jobs/${jobId}.json`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch source file coverage data by file ID
   * @param fileId - numeric file ID
   */
  async getSourceFile(fileId: number): Promise<CoverallsSourceFileData> {
    const url = `${this.baseUrl}/files/${fileId}.json`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch source file coverage data by build ID and filename
   * @param buildId - numeric build ID or commit SHA
   * @param filename - URL-encoded filename
   */
  async getSourceFileByName(
    buildId: number | string,
    filename: string
  ): Promise<CoverallsSourceFileData> {
    const url = `${this.baseUrl}/builds/${buildId}/source.json?filename=${encodeURIComponent(filename)}`;
    return this.fetchWithRetry(url);
  }

  /**
   * Fetch all builds for a repository across all pages
   * @param service - git service (e.g., 'github', 'gitlab')
   * @param owner - repository owner
   * @param repo - repository name
   * @param maxPages - maximum number of pages to fetch (default: Infinity)
   */
  async getAllRepoBuilds(
    service: string,
    owner: string,
    repo: string,
    maxPages = Infinity
  ): Promise<CoverallsRepoData[]> {
    const allBuilds: CoverallsRepoData[] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages && currentPage <= maxPages) {
      const data = await this.getRepoBuilds(service, owner, repo, currentPage);
      allBuilds.push(...data.builds);
      totalPages = data.pages;
      currentPage++;
    }

    return allBuilds;
  }

  /**
   * Analyze source file coverage data
   * Returns coverage statistics for a source file
   */
  analyzeSourceFile(coverage: CoverallsSourceFileData): {
    totalLines: number;
    relevantLines: number;
    coveredLines: number;
    uncoveredLines: number;
    coveragePercent: number;
    lineCoverage: Map<number, number | null>;
  } {
    const lineCoverage = new Map<number, number | null>();
    let relevantLines = 0;
    let coveredLines = 0;
    let uncoveredLines = 0;

    coverage.forEach((hits, index) => {
      const lineNumber = index + 1;
      lineCoverage.set(lineNumber, hits);

      if (hits !== null) {
        relevantLines++;
        if (hits > 0) {
          coveredLines++;
        } else {
          uncoveredLines++;
        }
      }
    });

    const coveragePercent = relevantLines > 0 ? (coveredLines / relevantLines) * 100 : 0;

    return {
      totalLines: coverage.length,
      relevantLines,
      coveredLines,
      uncoveredLines,
      coveragePercent,
      lineCoverage,
    };
  }
}

// Export a default instance
export const coverallsApi = new CoverallsApiClient();
