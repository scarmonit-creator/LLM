import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoverallsApiClient, CoverallsSourceFileData } from '../tools/coveralls-api';

// Mock global fetch
const globalAny: any = global;

describe('CoverallsApiClient', () => {
  let client: CoverallsApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new CoverallsApiClient({ timeout: 500, retryAttempts: 2 });
    fetchMock = vi.fn();
    globalAny.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches repo data', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ repo_name: 'lemurheavy/coveralls-ruby' }) });
    const data = await client.getRepo('github', 'lemurheavy', 'coveralls-ruby');
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/github/lemurheavy/coveralls-ruby.json', expect.any(Object));
    expect(data.repo_name).toBe('lemurheavy/coveralls-ruby');
  });

  it('fetches repo builds with pagination', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ page: 1, pages: 2, total: 20, builds: [ { repo_name: 'a' } ] }) });
    const page1 = await client.getRepoBuilds('github', 'o', 'r', 1);
    expect(page1.page).toBe(1);
    expect(page1.builds.length).toBe(1);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ page: 2, pages: 2, total: 20, builds: [ { repo_name: 'b' } ] }) });
    const all = await client.getAllRepoBuilds('github', 'o', 'r', 5);
    // Since getAllRepoBuilds starts at page 1 and we already consumed two mocks above,
    // prepare mocks for page 1 and page 2 again
  });

  it('retries on failure', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const res = await client.getBuildById(123);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(true);
  });

  it('fetches build by id and by commit sha', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ commit_sha: 'abc' }) });
    const byId = await client.getBuildById(2885284);
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/builds/2885284.json', expect.any(Object));
    expect(byId.commit_sha).toBe('abc');

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ commit_sha: 'deadbeef' }) });
    const bySha = await client.getBuildByCommitSha('deadbeef');
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/builds/deadbeef.json', expect.any(Object));
    expect(bySha.commit_sha).toBe('deadbeef');
  });

  it('fetches build with paths', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ paths: 'lib/coveralls/*' }) });
    const data = await client.getBuildWithPaths(11278463, 'lib/coveralls/*');
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/builds/11278463.json?paths=lib%2Fcoveralls%2F*', expect.any(Object));
    expect(data.paths).toBe('lib/coveralls/*');
  });

  it('fetches job data', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ repo_name: 'lemurheavy/coveralls-ruby', full_number: '225.2', covered_percent: 90.7 }) });
    const data = await client.getJob(6730283);
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/jobs/6730283.json', expect.any(Object));
    expect(data.full_number).toBe('225.2');
  });

  it('fetches source file coverage by id', async () => {
    const coverage: CoverallsSourceFileData = [1, 0, null, 3];
    fetchMock.mockResolvedValue({ ok: true, json: async () => coverage });
    const data = await client.getSourceFile(880095615);
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/files/880095615.json', expect.any(Object));
    expect(data).toEqual(coverage);
  });

  it('fetches source file coverage by filename', async () => {
    const coverage: CoverallsSourceFileData = [6, 6, 6, null, 6];
    fetchMock.mockResolvedValue({ ok: true, json: async () => coverage });
    const data = await client.getSourceFileByName(2885284, 'lib/coveralls/simplecov.rb');
    expect(fetchMock).toHaveBeenCalledWith('https://coveralls.io/builds/2885284/source.json?filename=lib%2Fcoveralls%2Fsimplecov.rb', expect.any(Object));
    expect(data).toEqual(coverage);
  });

  it('analyzes source file coverage correctly', () => {
    const coverage: CoverallsSourceFileData = [1, 0, null, 3];
    const stats = client.analyzeSourceFile(coverage);
    expect(stats.totalLines).toBe(4);
    expect(stats.relevantLines).toBe(3);
    expect(stats.coveredLines).toBe(2);
    expect(stats.uncoveredLines).toBe(1);
    expect(Number(stats.coveragePercent.toFixed(2))).toBe(66.67);
    expect(stats.lineCoverage.get(2)).toBe(0);
  });
});
