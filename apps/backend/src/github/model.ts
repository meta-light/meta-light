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
