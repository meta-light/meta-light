import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { id } from '../database/columns';

export const governanceProposals = sqliteTable(
  'governance_proposals',
  {
    id: id(),
    proposalId: text('proposal_id').notNull(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    branch: text('branch').notNull(),
    filePath: text('file_path').notNull(),
    fileName: text('file_name').notNull(),
    lastCommitSha: text('last_commit_sha').notNull(),
    lastCommitDate: integer('last_commit_date', {
      mode: 'timestamp_ms',
    }).notNull(),
    lastCommitAuthor: text('last_commit_author').notNull(),
    proposalNumber: text('proposal_number'),
    title: text('title'),
    status: text('status'),
    author: text('author'),
    created: integer('created', { mode: 'timestamp_ms' }),
    type: text('type'),
    category: text('category'),
    content: text('content').notNull(),
    contentMarkdown: text('content_markdown').notNull(),
    summary: text('summary'),
    motivation: text('motivation'),
    specification: text('specification'),
    githubUrl: text('github_url').notNull(),
    rawUrl: text('raw_url').notNull(),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastUpdatedAt: integer('last_updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    notified: integer('notified', { mode: 'boolean' }).notNull().default(false),
    updateCount: integer('update_count').notNull().default(0),
    csvHeaders: text('csv_headers', { mode: 'json' }).$type<string[]>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('governance_proposals_proposal_id_idx').on(table.proposalId),
    index('governance_proposals_repo_idx').on(
      table.owner,
      table.repo,
      table.lastUpdatedAt,
    ),
    index('governance_proposals_status_idx').on(table.status),
  ],
);

export const governanceRepoChecks = sqliteTable(
  'governance_repo_checks',
  {
    id: id(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    branch: text('branch').notNull(),
    lastCheckAt: integer('last_check_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastCommitSha: text('last_commit_sha'),
    lastCommitDate: integer('last_commit_date', { mode: 'timestamp_ms' }),
    proposalCount: integer('proposal_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('governance_repo_checks_identity_idx').on(
      table.owner,
      table.repo,
      table.branch,
    ),
  ],
);
