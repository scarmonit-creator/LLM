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
  // Optional fields when using paths parameter
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
  // Optional fields when using paths parameter
  paths?: string;
  selected_source_files_count?: number;
  paths_covered_percent?: number;
  paths_previous_covered_percent?: number;
  paths_covered_percent_change?: number;
}

export interface CoverallsSourceFileData {
  coverage: (number | null)[];
}

export interface SourceFileStats {
  totalLines: number;
  relevantLines: number;
  coveredLines: number;
  uncoveredLines: number;
  coveragePercent: number;
  linesByHitCount: Map<number, number[]>;
}

/**
 * Fetch repository data from Coveralls
 * @param owner - Repository owner (e.g., 'lemurheavy')
 * @param repo - Repository name (e.g., 'coveralls-ruby')
 * @param service - Git hosting service (default: 'github')
 * @returns Repository data including latest build coverage
 */
export async function getRepo(
  owner: string,
  repo: string,
  service: string = 'github'
): Promise<CoverallsRepoData> {
  const url = `https://coveralls.io/${service}/${owner}/${repo}.json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repo data: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch paginated builds for a repository
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param page - Page number (1-indexed)
 * @param service - Git hosting service (default: 'github')
 * @returns Paginated list of builds
 */
export async function getRepoBuilds(
  owner: string,
  repo: string,
  page: number = 1,
  service: string = 'github'
): Promise<CoverallsRepoBuildsData> {
  const url = `https://coveralls.io/${service}/${owner}/${repo}.json?page=${page}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch repo builds: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch all builds for a repository (across all pages)
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param service - Git hosting service (default: 'github')
 * @returns All builds from all pages
 */
export async function getAllRepoBuilds(
  owner: string,
  repo: string,
  service: string = 'github'
): Promise<CoverallsRepoData[]> {
  const firstPage = await getRepoBuilds(owner, repo, 1, service);
  const allBuilds = [...firstPage.builds];

  // Fetch remaining pages in parallel
  if (firstPage.pages > 1) {
    const pagePromises = [];
    for (let page = 2; page <= firstPage.pages; page++) {
      pagePromises.push(getRepoBuilds(owner, repo, page, service));
    }

    const remainingPages = await Promise.all(pagePromises);
    for (const pageData of remainingPages) {
      allBuilds.push(...pageData.builds);
    }
  }

  return allBuilds;
}

/**
 * Fetch build data by build ID
 * @param buildId - Numeric build ID
 * @returns Build data
 */
export async function getBuildById(
  buildId: number
): Promise<CoverallsBuildData> {
  const url = `https://coveralls.io/builds/${buildId}.json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch build: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch build data by commit SHA
 * @param commitSha - Full commit SHA
 * @returns Build data
 */
export async function getBuildByCommitSha(
  commitSha: string
): Promise<CoverallsBuildData> {
  const url = `https://coveralls.io/builds/${commitSha}.json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch build by commit SHA: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch build data with aggregated coverage for specific paths
 * @param buildIdOrSha - Build ID or commit SHA
 * @param paths - Comma-separated list of file paths or glob pattern (e.g., 'lib/coveralls/*')
 * @returns Build data with path-specific coverage stats
 */
export async function getBuildWithPaths(
  buildIdOrSha: string | number,
  paths: string
): Promise<CoverallsBuildData> {
  const url = `https://coveralls.io/builds/${buildIdOrSha}.json?paths=${encodeURIComponent(paths)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch build with paths: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch job data
 * @param jobId - Numeric job ID
 * @returns Job data
 */
export async function getJob(jobId: number): Promise<CoverallsJobData> {
  const url = `https://coveralls.io/jobs/${jobId}.json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch job: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch job data with aggregated coverage for specific paths
 * @param jobId - Numeric job ID
 * @param paths - Comma-separated list of file paths or glob pattern (e.g., 'lib/coveralls/*')
 * @returns Job data with path-specific coverage stats
 */
export async function getJobWithPaths(
  jobId: number,
  paths: string
): Promise<CoverallsJobData> {
  const url = `https://coveralls.io/jobs/${jobId}.json?paths=${encodeURIComponent(paths)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch job with paths: ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Fetch source file coverage data by file ID
 * @param fileId - Numeric file ID
 * @returns Array of coverage data (index = line number, value = hit count or null)
 */
export async function getSourceFile(
  fileId: number
): Promise<CoverallsSourceFileData> {
  const url = `https://coveralls.io/files/${fileId}.json`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch source file: ${response.status} ${response.statusText}`
    );
  }

  const coverage = await response.json();
  return { coverage };
}

/**
 * Fetch source file coverage data by filename
 * @param buildIdOrSha - Build ID or commit SHA
 * @param filename - URL-encoded filename (e.g., 'lib%2Fcoveralls%2Fsimplecov.rb')
 * @returns Array of coverage data
 */
export async function getSourceFileByName(
  buildIdOrSha: string | number,
  filename: string
): Promise<CoverallsSourceFileData> {
  const url = `https://coveralls.io/builds/${buildIdOrSha}/source.json?filename=${encodeURIComponent(filename)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch source file by name: ${response.status} ${response.statusText}`
    );
  }

  const coverage = await response.json();
  return { coverage };
}

/**
 * Analyze source file coverage data and return statistics
 * @param coverage - Coverage array from getSourceFile or getSourceFileByName
 * @returns Statistics about the file's coverage
 */
export function analyzeSourceFile(
  coverage: (number | null)[]
): SourceFileStats {
  const totalLines = coverage.length;
  const relevantLines = coverage.filter((v) => v !== null).length;
  const coveredLines = coverage.filter((v) => v !== null && v > 0).length;
  const uncoveredLines = relevantLines - coveredLines;
  const coveragePercent =
    relevantLines > 0 ? (coveredLines / relevantLines) * 100 : 0;

  // Group lines by hit count
  const linesByHitCount = new Map<number, number[]>();
  coverage.forEach((hitCount, lineNumber) => {
    if (hitCount !== null) {
      if (!linesByHitCount.has(hitCount)) {
        linesByHitCount.set(hitCount, []);
      }
      linesByHitCount.get(hitCount)!.push(lineNumber + 1); // Line numbers are 1-indexed
    }
  });

  return {
    totalLines,
    relevantLines,
    coveredLines,
    uncoveredLines,
    coveragePercent,
    linesByHitCount,
  };
}
