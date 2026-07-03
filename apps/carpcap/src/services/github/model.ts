import mongoose, { Schema, Document } from 'mongoose';

export interface IProposal extends Document {
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

const ProposalSchema = new Schema<IProposal>({
  proposalId: { type: String, required: true, unique: true, index: true },
  owner: { type: String, required: true, index: true },
  repo: { type: String, required: true, index: true },
  branch: { type: String, required: true },
  filePath: { type: String, required: true },
  fileName: { type: String, required: true },
  lastCommitSha: { type: String, required: true },
  lastCommitDate: { type: Date, required: true, index: true },
  lastCommitAuthor: { type: String, required: true },
  proposalNumber: { type: String, index: true },
  title: { type: String },
  status: { type: String, index: true },
  author: { type: String },
  created: { type: Date },
  type: { type: String },
  category: { type: String },
  content: { type: String, required: true },
  contentMarkdown: { type: String, required: true },
  summary: { type: String },
  motivation: { type: String },
  specification: { type: String },
  githubUrl: { type: String, required: true },
  rawUrl: { type: String, required: true },
  firstSeenAt: { type: Date, default: Date.now, index: true },
  lastUpdatedAt: { type: Date, default: Date.now },
  notified: { type: Boolean, default: false },
  updateCount: { type: Number, default: 0 },
  csvHeaders: { type: [String] }
}, {timestamps: true});

ProposalSchema.index({ owner: 1, repo: 1, lastUpdatedAt: -1 });
ProposalSchema.index({ status: 1, lastUpdatedAt: -1 });
ProposalSchema.index({ proposalNumber: 1, owner: 1 });
export const ProposalModel = mongoose.model<IProposal>('GovernanceProposal', ProposalSchema);

export interface IRepoCheck extends Document {
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

const RepoCheckSchema = new Schema<IRepoCheck>({
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  branch: { type: String, required: true },
  lastCheckAt: { type: Date, default: Date.now },
  lastCommitSha: { type: String },
  lastCommitDate: { type: Date },
  proposalCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  lastError: { type: String }
}, {timestamps: true});

RepoCheckSchema.index({ owner: 1, repo: 1, branch: 1 }, { unique: true });
export const RepoCheckModel = mongoose.model<IRepoCheck>('GovernanceRepoCheck', RepoCheckSchema);