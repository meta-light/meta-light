// GitHub client and governance-proposal parser, saved from the old backend
// github service (spun down). Not wired to anything. Reads GITHUB_TOKEN from
// the environment when no token is passed to GitHubAPIClient.

export interface IProposal {
  id: string;
  proposalId: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  fileName: string;
  lastCommitSha: string;
  lastCommitDate: Date;
  lastCommitAuthor: string;
  proposalNumber?: string;
  title?: string;
  status?: string;
  author?: string;
  created?: Date;
  type?: string;
  category?: string;
  content: string;
  contentMarkdown: string;
  summary?: string;
  motivation?: string;
  specification?: string;
  githubUrl: string;
  rawUrl: string;
  firstSeenAt: Date;
  lastUpdatedAt: Date;
  notified: boolean;
  updateCount: number;
  csvHeaders?: string[];
}

export interface IRepoCheck {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  lastCheckAt: Date;
  lastCommitSha?: string;
  lastCommitDate?: Date;
  proposalCount: number;
  errorCount: number;
  lastError?: string;
}

export interface TrackedRepo {
  owner: string;
  repo: string;
  branch?: string;
  enabled?: boolean;
  filePatterns?: string[];
  proposalType?: 'akash-aep' | 'helium-hip' | 'helium-hrp' | 'generic';
  disableTweetGeneration?: boolean;
  notificationOnly?: boolean;
  csvColumnTracking?: boolean;
  csvNewColumnOnly?: boolean;
}
export const GITHUB_CONFIG = {
  initialLookbackHours: 168,
  maxCommitsPerFetch: 100,
  enableNotifications: true,
  minCheckInterval: 30,
  ignoreFiles: ['README.md', 'LICENSE', '.gitignore', 'CONTRIBUTING.md'],
};

export const TRACKED_REPOS: TrackedRepo[] = [
  {
    owner: 'akash-network',
    repo: 'AEP',
    enabled: true,
    filePatterns: ['aep-*.md'],
    proposalType: 'akash-aep',
  },
  {
    owner: 'helium',
    repo: 'helium-release-proposals',
    enabled: true,
    filePatterns: ['*.md'],
    proposalType: 'helium-hrp',
  },
  {
    owner: 'helium',
    repo: 'HIP',
    enabled: true,
    filePatterns: ['*.md'],
    proposalType: 'helium-hip',
  },
  {
    owner: 'doublezerofoundation',
    repo: 'fees',
    enabled: true,
    filePatterns: ['fees_and_payments.csv'],
    notificationOnly: true,
    csvColumnTracking: true,
    csvNewColumnOnly: true,
  },
  {
    owner: 'malbeclabs',
    repo: 'doublezero',
    enabled: true,
    filePatterns: ['rfcs/*'],
    notificationOnly: true,
  },
  {
    owner: 'geodnet',
    repo: 'GIP',
    enabled: true,
    filePatterns: ['GIP*.md'],
    proposalType: 'generic',
    csvColumnTracking: true,
  },
];

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
    message: string;
    url: string;
    tree?: { sha: string; url: string };
  };
  url: string;
  html_url: string;
  author?: { login: string; avatar_url: string } | null;
  files?: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    sha: string;
    raw_url: string;
  }>;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content?: string;
  encoding?: string;
}
export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export class GitHubAPIClient {
  private baseUrl = 'https://api.github.com';
  private token: string | undefined;
  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CarpCap-Bot',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private logRateLimit(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    if (remaining && parseInt(remaining) < 10) {
      console.warn(
        `GitHub API rate limit low: ${remaining} requests remaining`,
      );
      if (reset) {
        const resetDate = new Date(parseInt(reset) * 1000);
        console.warn(`Rate limit resets at: ${resetDate.toISOString()}`);
      }
    }
  }

  async fetchCommits(
    owner: string,
    repo: string,
    options: {
      branch?: string;
      since?: string;
      until?: string;
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<GitHubCommitResponse[]> {
    const { branch = 'main', since, until, per_page = 100, page = 1 } = options;
    const params = new URLSearchParams({
      sha: branch,
      per_page: per_page.toString(),
      page: page.toString(),
    });
    if (since) params.append('since', since);
    if (until) params.append('until', until);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits?${params}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }
      this.logRateLimit(response);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching commits from ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async fetchCommitDetails(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubCommitResponse> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits/${sha}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }
      this.logRateLimit(response);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching commit details for ${sha}:`, error);
      throw error;
    }
  }

  async fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<GitHubFileContent> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {
      url += `?ref=${ref}`;
    }
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }
      this.logRateLimit(response);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching file content for ${path}:`, error);
      throw error;
    }
  }

  async fetchRawFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string> {
    const branch = ref || 'main';
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch raw content: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Error fetching raw file content for ${path}:`, error);
      throw error;
    }
  }

  async fetchDirectoryContents(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string,
  ): Promise<GitHubFileContent[]> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {
      url += `?ref=${ref}`;
    }
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }
      this.logRateLimit(response);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching directory contents for ${path}:`, error);
      throw error;
    }
  }

  async fetchTree(
    owner: string,
    repo: string,
    treeSha: string,
    recursive: boolean = true,
  ): Promise<GitHubTreeItem[]> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}`;
    if (recursive) {
      url += '?recursive=1';
    }
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }
      this.logRateLimit(response);
      const data = await response.json();
      return data.tree;
    } catch (error) {
      console.error(`Error fetching tree for ${treeSha}:`, error);
      throw error;
    }
  }

  async fetchRepository(owner: string, repo: string): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
      }
      this.logRateLimit(response);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching repository ${owner}/${repo}:`, error);
      throw error;
    }
  }

  async checkRateLimit(): Promise<{
    remaining: number;
    limit: number;
    reset: Date;
  }> {
    const url = `${this.baseUrl}/rate_limit`;
    try {
      const response = await fetch(url, { headers: this.getHeaders() });
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      const data = await response.json();
      const core = data.resources.core;
      return {
        remaining: core.remaining,
        limit: core.limit,
        reset: new Date(core.reset * 1000),
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw error;
    }
  }
}

export interface ParsedProposal {
  proposalNumber?: string;
  title?: string;
  status?: string;
  author?: string;
  created?: Date;
  type?: string;
  category?: string;
  summary?: string;
  motivation?: string;
  specification?: string;
}

export class ProposalParser {
  static parse(content: string, proposalType: string): ParsedProposal {
    switch (proposalType) {
      case 'akash-aep':
        return this.parseAkashAEP(content);
      case 'helium-hip':
        return this.parseHeliumHIP(content);
      case 'helium-hrp':
        return this.parseHeliumHRP(content);
      default:
        return this.parseGeneric(content);
    }
  }

  private static parseAkashAEP(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.proposalNumber = this.extractField(frontmatter, ['aep', 'number']);
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type']);
      result.category = this.extractField(frontmatter, ['category']);
      const createdStr = this.extractField(frontmatter, ['created', 'date']);
      if (createdStr) {
        result.created = new Date(createdStr);
      }
    }
    result.summary = this.extractSection(content, [
      'summary',
      'abstract',
      'simple summary',
    ]);
    result.motivation = this.extractSection(content, [
      'motivation',
      'rationale',
    ]);
    result.specification = this.extractSection(content, [
      'specification',
      'technical specification',
      'implementation',
    ]);
    if (!result.title) {
      result.title = this.extractTitleFromContent(content);
    }
    if (!result.proposalNumber) {
      result.proposalNumber = this.extractProposalNumber(content, 'AEP');
    }
    return result;
  }

  private static parseHeliumHIP(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.proposalNumber = this.extractField(frontmatter, [
        'hip',
        'hip-num',
        'number',
      ]);
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type', 'hip-type']);
      result.category = this.extractField(frontmatter, ['category']);
      const createdStr = this.extractField(frontmatter, [
        'created',
        'date',
        'created-date',
      ]);
      if (createdStr) {
        result.created = new Date(createdStr);
      }
    }
    result.summary = this.extractSection(content, [
      'summary',
      'abstract',
      'simple summary',
    ]);
    result.motivation = this.extractSection(content, [
      'motivation',
      'rationale',
      'background',
    ]);
    result.specification = this.extractSection(content, [
      'specification',
      'detailed explanation',
      'technical implementation',
    ]);
    if (!result.title) {
      result.title = this.extractTitleFromContent(content);
    }
    if (!result.proposalNumber) {
      result.proposalNumber = this.extractProposalNumber(content, 'HIP');
    }
    return result;
  }

  private static parseHeliumHRP(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.proposalNumber = this.extractField(frontmatter, ['hrp', 'number']);
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type']);
      const createdStr = this.extractField(frontmatter, ['created', 'date']);
      if (createdStr) {
        result.created = new Date(createdStr);
      }
    }
    result.summary = this.extractSection(content, ['summary', 'overview']);
    result.motivation = this.extractSection(content, ['motivation', 'context']);
    result.specification = this.extractSection(content, [
      'changes',
      'implementation',
      'details',
    ]);
    if (!result.title) {
      result.title = this.extractTitleFromContent(content);
    }
    if (!result.proposalNumber) {
      result.proposalNumber = this.extractProposalNumber(content, 'HRP');
    }
    return result;
  }

  private static parseGeneric(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type']);
      const createdStr = this.extractField(frontmatter, ['created', 'date']);
      if (createdStr) {
        result.created = new Date(createdStr);
      }
    }
    result.summary = this.extractSection(content, [
      'summary',
      'abstract',
      'overview',
    ]);
    result.motivation = this.extractSection(content, [
      'motivation',
      'rationale',
      'background',
    ]);
    result.specification = this.extractSection(content, [
      'specification',
      'implementation',
      'details',
    ]);
    if (!result.title) {
      result.title = this.extractTitleFromContent(content);
    }
    return result;
  }

  private static extractField(
    frontmatter: string,
    fieldNames: string[],
  ): string | undefined {
    for (const fieldName of fieldNames) {
      const regex = new RegExp(`^${fieldName}\\s*:\\s*(.+?)\\s*$`, 'mi');
      const match = frontmatter.match(regex);
      if (match) {
        return match[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    return undefined;
  }

  private static extractSection(
    content: string,
    sectionNames: string[],
  ): string | undefined {
    for (const sectionName of sectionNames) {
      const regex = new RegExp(
        `#{1,3}\\s+${sectionName}\\s*\n([\\s\\S]*?)(?=\n#{1,3}\\s+|$)`,
        'i',
      );
      const match = content.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private static extractTitleFromContent(content: string): string | undefined {
    const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
    const h1Match = withoutFrontmatter.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].trim();
    }
    return undefined;
  }

  private static extractProposalNumber(
    content: string,
    prefix: string,
  ): string | undefined {
    const regex = new RegExp(`${prefix}[\\s-]*(\\d+)`, 'i');
    const match = content.match(regex);
    if (match) {
      return `${prefix}-${match[1].padStart(3, '0')}`;
    }
    return undefined;
  }

  static isProposalFile(filename: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return filename.endsWith('.md');
    }
    for (const pattern of patterns) {
      if (this.matchesPattern(filename, pattern)) {
        return true;
      }
    }
    return false;
  }

  private static matchesPattern(filename: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }

  static parseCSVHeaders(content: string): string[] | null {
    if (!content || content.trim().length === 0) {
      return null;
    }
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) {
      return null;
    }
    const firstLine = lines[0].trim();
    if (!firstLine) {
      return null;
    }
    const headers = firstLine.split(',').map((h) => h.trim());
    if (headers.length === 0 || (headers.length === 1 && !headers[0])) {
      return null;
    }
    return headers;
  }

  static isCSVFile(filename: string): boolean {
    return filename.toLowerCase().endsWith('.csv');
  }
}
