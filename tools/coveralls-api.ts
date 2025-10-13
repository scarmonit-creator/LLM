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

export async function getAllRepoBuilds(
  owner: string,
  repo: string,
  service: string = 'github'
): Promise<CoverallsRepoData[]> {
  const firstPage = await getRepoBuilds(owner, repo, 1, service);
  const allBuilds = [...firstPage.builds];

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

export function analyzeSourceFile(
  coverage: (number | null)[]
): SourceFileStats {
  const totalLines = coverage.length;
  const relevantLines = coverage.filter((v) => v !== null).length;
  const coveredLines = coverage.filter((v) => v !== null && v > 0).length;
  const uncoveredLines = relevantLines - coveredLines;
  const coveragePercent =
    relevantLines > 0 ? (coveredLines / relevantLines) * 100 : 0;

  const linesByHitCount = new Map<number, number[]>();
  coverage.forEach((hitCount, lineNumber) => {
    if (hitCount !== null) {
      if (!linesByHitCount.has(hitCount)) {
        linesByHitCount.set(hitCount, []);
      }
      linesByHitCount.get(hitCount)!.push(lineNumber + 1);
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
