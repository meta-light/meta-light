import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { IProposal, IRepoCheck } from './model';
import { connectDatabase, getDb } from '../database/client';
import { governanceProposals, governanceRepoChecks } from './schema';

type ProposalRow = typeof governanceProposals.$inferSelect;
type RepoCheckRow = typeof governanceRepoChecks.$inferSelect;

function toProposal(row: ProposalRow): IProposal {
  return {
    id: row.id,
    proposalId: row.proposalId,
    owner: row.owner,
    repo: row.repo,
    branch: row.branch,
    filePath: row.filePath,
    fileName: row.fileName,
    lastCommitSha: row.lastCommitSha,
    lastCommitDate: row.lastCommitDate,
    lastCommitAuthor: row.lastCommitAuthor,
    proposalNumber: row.proposalNumber ?? undefined,
    title: row.title ?? undefined,
    status: row.status ?? undefined,
    author: row.author ?? undefined,
    created: row.created ?? undefined,
    type: row.type ?? undefined,
    category: row.category ?? undefined,
    content: row.content,
    contentMarkdown: row.contentMarkdown,
    summary: row.summary ?? undefined,
    motivation: row.motivation ?? undefined,
    specification: row.specification ?? undefined,
    githubUrl: row.githubUrl,
    rawUrl: row.rawUrl,
    firstSeenAt: row.firstSeenAt,
    lastUpdatedAt: row.lastUpdatedAt,
    notified: row.notified,
    updateCount: row.updateCount,
    csvHeaders: row.csvHeaders ?? undefined,
  };
}

function toRepoCheck(row: RepoCheckRow): IRepoCheck {
  return {
    id: row.id,
    owner: row.owner,
    repo: row.repo,
    branch: row.branch,
    lastCheckAt: row.lastCheckAt,
    lastCommitSha: row.lastCommitSha ?? undefined,
    lastCommitDate: row.lastCommitDate ?? undefined,
    proposalCount: row.proposalCount,
    errorCount: row.errorCount,
    lastError: row.lastError ?? undefined,
  };
}

export type ProposalInput = Omit<IProposal, 'id'>;

export async function findProposalByKey(
  proposalId: string,
): Promise<IProposal | null> {
  await connectDatabase();
  const [row] = await getDb()
    .select()
    .from(governanceProposals)
    .where(eq(governanceProposals.proposalId, proposalId))
    .limit(1);
  return row ? toProposal(row) : null;
}

export async function createProposal(
  input: Omit<ProposalInput, 'fileName'> & { fileName?: string },
): Promise<IProposal> {
  await connectDatabase();
  const [row] = await getDb()
    .insert(governanceProposals)
    .values({
      proposalId: input.proposalId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      filePath: input.filePath,
      fileName:
        input.fileName || input.filePath.split('/').pop() || input.filePath,
      lastCommitSha: input.lastCommitSha,
      lastCommitDate: input.lastCommitDate,
      lastCommitAuthor: input.lastCommitAuthor,
      proposalNumber: input.proposalNumber,
      title: input.title,
      status: input.status,
      author: input.author,
      created: input.created,
      type: input.type,
      category: input.category,
      content: input.content,
      contentMarkdown: input.contentMarkdown,
      summary: input.summary,
      motivation: input.motivation,
      specification: input.specification,
      githubUrl: input.githubUrl,
      rawUrl: input.rawUrl,
      firstSeenAt: input.firstSeenAt ?? new Date(),
      lastUpdatedAt: input.lastUpdatedAt ?? new Date(),
      notified: input.notified ?? false,
      updateCount: input.updateCount ?? 0,
      csvHeaders: input.csvHeaders,
      updatedAt: new Date(),
    })
    .returning();
  return toProposal(row);
}

export async function saveProposal(proposal: IProposal): Promise<void> {
  await connectDatabase();
  await getDb()
    .update(governanceProposals)
    .set({
      lastCommitSha: proposal.lastCommitSha,
      lastCommitDate: proposal.lastCommitDate,
      lastCommitAuthor: proposal.lastCommitAuthor,
      proposalNumber: proposal.proposalNumber,
      title: proposal.title,
      status: proposal.status,
      author: proposal.author,
      created: proposal.created,
      type: proposal.type,
      category: proposal.category,
      content: proposal.content,
      contentMarkdown: proposal.contentMarkdown,
      summary: proposal.summary,
      motivation: proposal.motivation,
      specification: proposal.specification,
      lastUpdatedAt: proposal.lastUpdatedAt,
      notified: proposal.notified,
      updateCount: proposal.updateCount,
      csvHeaders: proposal.csvHeaders,
      updatedAt: new Date(),
    })
    .where(eq(governanceProposals.id, proposal.id));
}

export async function countProposals(
  owner: string,
  repo: string,
): Promise<number> {
  await connectDatabase();
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(governanceProposals)
    .where(
      and(
        eq(governanceProposals.owner, owner),
        eq(governanceProposals.repo, repo),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function listRecentProposals(limit: number): Promise<IProposal[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(governanceProposals)
    .orderBy(desc(governanceProposals.lastUpdatedAt))
    .limit(limit);
  return rows.map(toProposal);
}

export async function listProposalsByStatus(
  status: string,
): Promise<IProposal[]> {
  await connectDatabase();
  const pattern = `%${status.replace(/[%_\\]/g, '\\$&')}%`;
  const rows = await getDb()
    .select()
    .from(governanceProposals)
    .where(
      sql`lower(coalesce(${governanceProposals.status}, '')) like ${pattern.toLowerCase()} escape '\\'`,
    )
    .orderBy(desc(governanceProposals.lastUpdatedAt));
  return rows.map(toProposal);
}

export async function listProposalsForRepo(
  owner: string,
  repo: string,
): Promise<IProposal[]> {
  await connectDatabase();
  const rows = await getDb()
    .select()
    .from(governanceProposals)
    .where(
      and(
        eq(governanceProposals.owner, owner),
        eq(governanceProposals.repo, repo),
      ),
    );
  return rows.map(toProposal);
}

export async function markProposalsNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await connectDatabase();
  for (let offset = 0; offset < ids.length; offset += 80) {
    await getDb()
      .update(governanceProposals)
      .set({ notified: true, updatedAt: new Date() })
      .where(inArray(governanceProposals.id, ids.slice(offset, offset + 80)));
  }
}

export async function findRepoCheck(
  owner: string,
  repo: string,
  branch: string,
): Promise<IRepoCheck | null> {
  await connectDatabase();
  const [row] = await getDb()
    .select()
    .from(governanceRepoChecks)
    .where(
      and(
        eq(governanceRepoChecks.owner, owner),
        eq(governanceRepoChecks.repo, repo),
        eq(governanceRepoChecks.branch, branch),
      ),
    )
    .limit(1);
  return row ? toRepoCheck(row) : null;
}

export async function upsertRepoCheck(input: {
  owner: string;
  repo: string;
  branch: string;
  lastCheckAt?: Date;
  lastCommitSha?: string;
  lastCommitDate?: Date;
  proposalCount?: number;
  errorCount?: number;
  lastError?: string | null;
  incrementError?: boolean;
}): Promise<void> {
  await connectDatabase();
  const existing = await findRepoCheck(input.owner, input.repo, input.branch);
  const errorCount = input.incrementError
    ? (existing?.errorCount ?? 0) + 1
    : (input.errorCount ?? existing?.errorCount ?? 0);
  const values = {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    lastCheckAt: input.lastCheckAt ?? new Date(),
    lastCommitSha: input.lastCommitSha ?? existing?.lastCommitSha,
    lastCommitDate: input.lastCommitDate ?? existing?.lastCommitDate,
    proposalCount: input.proposalCount ?? existing?.proposalCount ?? 0,
    errorCount,
    lastError:
      input.lastError === undefined ? existing?.lastError : input.lastError,
    updatedAt: new Date(),
  };
  if (!existing) {
    await getDb().insert(governanceRepoChecks).values(values);
    return;
  }
  await getDb()
    .update(governanceRepoChecks)
    .set(values)
    .where(eq(governanceRepoChecks.id, existing.id));
}
