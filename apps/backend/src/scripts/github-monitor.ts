import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace');
const CONFIG_PATH =
  process.env.TWITTER_ACCOUNTS_CONFIG || path.join(WORKSPACE_DIR, 'config', 'twitter-accounts.json');
const CACHE_PATH = process.env.GITHUB_CACHE_PATH || path.join(WORKSPACE_DIR, '.github-cache.json');

const MAX_REQUESTS_PER_HOUR = 60;
let requestCount = 0;

type RepoConfig = {
  owner: string;
  repo: string;
  enabled?: boolean;
  filePatterns?: string[];
  csvColumnTracking?: boolean;
  notificationOnly?: boolean;
  proposalType?: string;
};

type CacheFile = {
  sha?: string;
  lastChecked?: number;
  lastModified?: number;
  columns?: string[];
};

type Cache = {
  lastChecked: Record<string, number>;
  files: Record<string, CacheFile>;
};

type GithubFile = {
  filename: string;
  sha: string;
  raw_url?: string;
};

type GithubCommit = {
  sha: string;
  commit?: { author?: { date?: string } };
  files?: GithubFile[];
};

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as {
  github_repos?: RepoConfig[];
};
const repos = config.github_repos?.filter((repo) => repo.enabled) || [];

let cache: Cache = { lastChecked: {}, files: {} };
try {
  cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as Cache;
} catch {
  cache = { lastChecked: {}, files: {} };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchGitHub(url: string): Promise<unknown> {
  requestCount += 1;
  if (requestCount > MAX_REQUESTS_PER_HOUR) {
    console.error('  Rate limit exceeded, skipping request');
    return null;
  }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OpenClaw-GitHub-Monitor',
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      console.error(
        response.status === 429
          ? '  GitHub rate limited, skipping'
          : response.status === 403
            ? '  GitHub 403, skipping'
            : `  GitHub API error: ${response.status}`,
      );
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`  Fetch error: ${message(error)}`);
    return null;
  }
}

async function checkNewFiles(owner: string, repo: string, filePatterns: string[] = []) {
  const results: Array<Record<string, unknown>> = [];
  try {
    const commits = await fetchGitHub(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
    );
    if (!Array.isArray(commits)) return results;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    for (const commit of commits as GithubCommit[]) {
      const authored = commit.commit?.author?.date;
      if (authored && new Date(authored).getTime() < oneDayAgo) break;
      for (const file of commit.files || []) {
        const matchesPattern = filePatterns.some((pattern) =>
          new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`).test(file.filename),
        );
        if (!matchesPattern) continue;
        const fileKey = `${owner}/${repo}/${file.filename}`;
        const cached = cache.files[fileKey];
        if (cached && cached.sha === file.sha) continue;
        results.push({
          path: file.filename,
          url:
            file.raw_url ||
            `https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/${file.filename}`,
          web_url: `https://github.com/${owner}/${repo}/blob/${commit.sha}/${file.filename}`,
          sha: file.sha,
          name: file.filename.split('/').pop(),
          isNew: !cached,
          commitDate: authored,
        });
        cache.files[fileKey] = {
          sha: file.sha,
          lastChecked: now,
          lastModified: authored ? new Date(authored).getTime() : now,
        };
      }
    }
    cache.lastChecked[`${owner}/${repo}`] = now;
  } catch (error) {
    console.error(`Error checking ${owner}/${repo}: ${message(error)}`);
  }
  return results;
}

async function checkCSVColumns(owner: string, repo: string, filePath: string) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`);
    if (!response.ok) {
      console.error(`  Failed to fetch CSV: ${response.status}`);
      return null;
    }
    const headers = (await response.text()).split('\n')[0]?.split(',').map((header) => header.trim()) || [];
    const fileKey = `${owner}/${repo}/${filePath}`;
    const cachedColumns = cache.files[fileKey]?.columns;
    const newColumns = cachedColumns ? headers.filter((header) => !cachedColumns.includes(header)) : headers;
    cache.files[fileKey] = { ...cache.files[fileKey], columns: headers, lastChecked: Date.now() };
    if (newColumns.length === 0) return null;
    return {
      filePath,
      url: `https://github.com/${owner}/${repo}/blob/main/${filePath}`,
      newColumns,
      totalColumns: headers.length,
    };
  } catch (error) {
    console.error(`Error checking CSV ${owner}/${repo}/${filePath}: ${message(error)}`);
    return null;
  }
}

export async function getFileContent(owner: string, repo: string, filePath: string) {
  try {
    const file = (await fetchGitHub(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    )) as { type?: string; content?: string } | null;
    if (!file || file.type !== 'file' || !file.content) return null;
    return Buffer.from(file.content, 'base64').toString('utf8');
  } catch (error) {
    console.error(`Error fetching content: ${message(error)}`);
    return null;
  }
}

export async function main() {
  console.log('GitHub Repo Monitor - Started');
  console.log(`Monitoring ${repos.length} repos\n`);
  const allResults = [];
  for (const repo of repos) {
    console.log(`Checking ${repo.owner}/${repo.repo}...`);
    const csvPattern = repo.filePatterns?.find((pattern) => pattern.includes('.csv'));
    if (repo.csvColumnTracking && csvPattern) {
      const csvFile = csvPattern.replace('*', '');
      const csvResult = await checkCSVColumns(repo.owner, repo.repo, csvFile);
      allResults.push(
        csvResult
          ? { type: 'csv-change', owner: repo.owner, repo: repo.repo, ...csvResult, proposalType: repo.proposalType }
          : null,
      );
      continue;
    }
    const newFiles = await checkNewFiles(repo.owner, repo.repo, repo.filePatterns);
    if (newFiles.length === 0) {
      console.log(repo.notificationOnly ? '  No new files' : '  No new proposals');
      continue;
    }
    const files = repo.notificationOnly
      ? newFiles
      : await Promise.all(
          newFiles.map(async (file) => ({
            ...file,
            content: await getFileContent(repo.owner, repo.repo, String(file.path)),
          })),
        );
    allResults.push({
      type: repo.notificationOnly ? 'notification' : 'proposal',
      owner: repo.owner,
      repo: repo.repo,
      files,
      proposalType: repo.proposalType,
    });
  }
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  return allResults.filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((results) => {
      console.log('\nGitHub monitoring complete.');
      for (const result of results) {
        console.log(`  - ${result?.type}: ${result?.owner}/${result?.repo}`);
      }
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
