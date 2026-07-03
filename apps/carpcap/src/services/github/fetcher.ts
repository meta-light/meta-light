import { GITHUB_TOKEN } from '../../env';

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    author: {name: string; email: string; date: string;};
    committer: {name: string; email: string; date: string;};
    message: string;
    url: string;
    tree?: {sha: string; url: string;};
  };
  url: string;
  html_url: string;
  author?: {login: string; avatar_url: string;} | null;
  files?: Array<{filename: string; status: string; additions: number; deletions: number; sha: string; raw_url: string;}>;
}

export interface GitHubFileContent {name: string; path: string; sha: string; size: number; url: string; html_url: string; git_url: string; download_url: string; type: string; content?: string; encoding?: string;}
export interface GitHubTreeItem {path: string; mode: string; type: 'blob' | 'tree'; sha: string; size?: number; url: string;}

export class GitHubAPIClient {
  private baseUrl = 'https://api.github.com';
  private token: string | undefined;
  constructor(token?: string) {this.token = token || GITHUB_TOKEN;}

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'CarpCap-Bot'};
    if (this.token) {headers['Authorization'] = `Bearer ${this.token}`;}
    return headers;
  }

  private logRateLimit(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    if (remaining && parseInt(remaining) < 10) {
      console.warn(`⚠️ GitHub API rate limit low: ${remaining} requests remaining`);
      if (reset) {const resetDate = new Date(parseInt(reset) * 1000); console.warn(`Rate limit resets at: ${resetDate.toISOString()}`);}
    }
  }

  async fetchCommits(owner: string, repo: string, options: {branch?: string; since?: string; until?: string; per_page?: number; page?: number;} = {}): Promise<GitHubCommitResponse[]> {
    const {branch = 'main', since, until, per_page = 100, page = 1} = options;
    const params = new URLSearchParams({sha: branch, per_page: per_page.toString(), page: page.toString()});
    if (since) params.append('since', since);
    if (until) params.append('until', until);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits?${params}`;
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {const errorText = await response.text(); throw new Error(`GitHub API error: ${response.status} - ${errorText}`);}
      this.logRateLimit(response);
      return await response.json();
    } 
    catch (error) {console.error(`Error fetching commits from ${owner}/${repo}:`, error); throw error;}
  }

  async fetchCommitDetails(owner: string, repo: string, sha: string): Promise<GitHubCommitResponse> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits/${sha}`;
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {const errorText = await response.text(); throw new Error(`GitHub API error: ${response.status} - ${errorText}`);}
      this.logRateLimit(response);
      return await response.json();
    } 
    catch (error) {console.error(`Error fetching commit details for ${sha}:`, error); throw error;}
  }

  async fetchFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFileContent> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {url += `?ref=${ref}`;}
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {const errorText = await response.text(); throw new Error(`GitHub API error: ${response.status} - ${errorText}`);}
      this.logRateLimit(response);
      return await response.json();
    } 
    catch (error) {console.error(`Error fetching file content for ${path}:`, error); throw error;}
  }

  async fetchRawFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const branch = ref || 'main';
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {throw new Error(`Failed to fetch raw content: ${response.status}`);}
      return await response.text();
    } 
    catch (error) {console.error(`Error fetching raw file content for ${path}:`, error); throw error;}
  }

  async fetchDirectoryContents(owner: string, repo: string, path: string = '', ref?: string): Promise<GitHubFileContent[]> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
    if (ref) {url += `?ref=${ref}`;}
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {const errorText = await response.text(); throw new Error(`GitHub API error: ${response.status} - ${errorText}`);}
      this.logRateLimit(response);
      return await response.json();
    } 
    catch (error) {console.error(`Error fetching directory contents for ${path}:`, error); throw error;}
  }

  async fetchTree(owner: string, repo: string, treeSha: string, recursive: boolean = true): Promise<GitHubTreeItem[]> {
    let url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}`;
    if (recursive) {url += '?recursive=1';}
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {const errorText = await response.text(); throw new Error(`GitHub API error: ${response.status} - ${errorText}`);}
      this.logRateLimit(response);
      const data = await response.json();
      return data.tree;
    } 
    catch (error) {console.error(`Error fetching tree for ${treeSha}:`, error); throw error;}
  }

  async fetchRepository(owner: string, repo: string): Promise<any> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {const errorText = await response.text(); throw new Error(`GitHub API error: ${response.status} - ${errorText}`);}
      this.logRateLimit(response);
      return await response.json();
    } 
    catch (error) {console.error(`Error fetching repository ${owner}/${repo}:`, error); throw error;}
  }

  async checkRateLimit(): Promise<{ remaining: number; limit: number; reset: Date }> {
    const url = `${this.baseUrl}/rate_limit`;
    try {
      const response = await fetch(url, {headers: this.getHeaders()});
      if (!response.ok) {throw new Error(`GitHub API error: ${response.status}`);}
      const data = await response.json();
      const core = data.resources.core;
      return {remaining: core.remaining, limit: core.limit, reset: new Date(core.reset * 1000)};
    } 
    catch (error) {console.error('Error checking rate limit:', error); throw error;}
  }
}