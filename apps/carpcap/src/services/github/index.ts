import { GitHubAPIClient } from './fetcher';
import { ProposalModel, RepoCheckModel, IProposal } from './model';
import { TRACKED_REPOS, GITHUB_CONFIG, TrackedRepo } from './config';
import { ProposalParser } from './parser';
import { telegramBot } from '../../utils/telegram';
import { queryGrok } from '../../utils/ai';
import { Tweets } from '../../utils/twitter/schema';
import { githubSystemPrompt, githubUserPrompt } from './prompts';

export class GitHubProposalMonitor {
    private client: GitHubAPIClient;
    constructor(token?: string) {this.client = new GitHubAPIClient(token);}
    async initializeBaseline(trackedRepo: TrackedRepo): Promise<number> {
        const { owner, repo, branch = 'main', filePatterns, proposalType = 'generic' } = trackedRepo;
        console.log(`Initializing baseline for ${owner}/${repo}...`);
        try {
            const repoInfo = await this.client.fetchRepository(owner, repo);
            const defaultBranch = branch || repoInfo.default_branch || 'main';
            const commits = await this.client.fetchCommits(owner, repo, {branch: defaultBranch, per_page: 1});
            if (commits.length === 0) {console.log('No commits found in repo'); return 0;}
            const latestCommitSha = commits[0].sha;
            const commitDetails: any = await this.client.fetchCommitDetails(owner, repo, latestCommitSha);
            const treeSha = commitDetails.commit?.tree?.sha;
            if (!treeSha) {throw new Error('Could not get tree SHA from commit');}
            const tree = await this.client.fetchTree(owner, repo, treeSha, true);
            const proposalFiles = tree.filter(item => item.type === 'blob' && ProposalParser.isProposalFile(item.path, filePatterns) && !GITHUB_CONFIG.ignoreFiles.includes(item.path.split('/').pop() || ''));
            console.log(`Found ${proposalFiles.length} existing proposal files`);
            let savedCount = 0;
            for (const file of proposalFiles) {
                try {
                    const rawContent = await this.client.fetchRawFileContent(owner, repo, file.path, branch);
                    const parsed = ProposalParser.parse(rawContent, proposalType);
                    const proposalId = `${owner}/${repo}/${file.path}`;
                    const existing = await ProposalModel.findOne({ proposalId });
                    if (existing) continue;
                    const csvHeaders = ProposalParser.isCSVFile(file.path) ? ProposalParser.parseCSVHeaders(rawContent) : undefined;
                    await ProposalModel.create({
                        proposalId,
                        owner,
                        repo,
                        branch,
                        filePath: file.path,
                        fileName: file.path.split('/').pop(),
                        lastCommitSha: file.sha,
                        lastCommitDate: new Date(),
                        lastCommitAuthor: 'baseline',
                        proposalNumber: parsed.proposalNumber,
                        title: parsed.title,
                        status: parsed.status,
                        author: parsed.author,
                        created: parsed.created,
                        type: parsed.type,
                        category: parsed.category,
                        content: rawContent,
                        contentMarkdown: rawContent,
                        summary: parsed.summary,
                        motivation: parsed.motivation,
                        specification: parsed.specification,
                        githubUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${file.path}`,
                        rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`,
                        firstSeenAt: new Date(),
                        lastUpdatedAt: new Date(),
                        notified: true,
                        updateCount: 0,
                        csvHeaders: csvHeaders || undefined
                    });
                    savedCount++;
                    await new Promise(resolve => setTimeout(resolve, 300));
                } 
                catch (error) {console.error(`Error processing ${file.path}:`, error);}
            }
            console.log(`Initialized ${savedCount} baseline proposals`);
            return savedCount;
        } 
        catch (error) {console.error(`Error initializing baseline for ${owner}/${repo}:`, error); throw error;}
    }

    async checkRepository(trackedRepo: TrackedRepo): Promise<{newProposals: number; updatedProposals: number; totalChecked: number; proposals: IProposal[];}> {
        const { owner, repo, branch = 'main', filePatterns, proposalType = 'generic', notificationOnly = false } = trackedRepo;
        console.log(`Checking ${owner}/${repo} for ${notificationOnly ? 'changes' : 'proposals'}...`);
        try {
            if (!notificationOnly) {
                const existingProposalCount = await ProposalModel.countDocuments({ owner, repo });
                if (existingProposalCount === 0) {console.log('No baseline found - initializing...'); await this.initializeBaseline(trackedRepo); return { newProposals: 0, updatedProposals: 0, totalChecked: 0, proposals: [] };}
            }
            const repoCheck = await RepoCheckModel.findOne({ owner, repo, branch });
            const options: any = {branch, per_page: GITHUB_CONFIG.maxCommitsPerFetch};
            if (repoCheck?.lastCommitDate) {options.since = repoCheck.lastCommitDate.toISOString();} 
            else {const lookbackDate = new Date(Date.now() - GITHUB_CONFIG.initialLookbackHours * 60 * 60 * 1000); options.since = lookbackDate.toISOString();}
            const commits = await this.client.fetchCommits(owner, repo, options);
            if (commits.length === 0) {
                console.log('No new commits since last check');
                await RepoCheckModel.findOneAndUpdate({ owner, repo, branch }, {$set: {lastCheckAt: new Date(), errorCount: 0}}, { upsert: true, new: true });
                return { newProposals: 0, updatedProposals: 0, totalChecked: 0, proposals: [] };
            }
            console.log(`Found ${commits.length} new commits to analyze`);
            const latestCommitSha = commits[0].sha;
            const hasNewCommits = !repoCheck?.lastCommitSha || repoCheck.lastCommitSha !== latestCommitSha;
            const changedFiles = new Map<string, { sha: string; commitDate: Date; author: string }>();
            for (const commit of commits) {
                const detailedCommit = await this.client.fetchCommitDetails(owner, repo, commit.sha);
                if (detailedCommit.files) {
                    for (const file of detailedCommit.files) {
                        const isIgnored = GITHUB_CONFIG.ignoreFiles.includes(file.filename);
                        const isProposal = ProposalParser.isProposalFile(file.filename, filePatterns);
                        if (!isIgnored && isProposal && (file.status === 'added' || file.status === 'modified')) {if (!changedFiles.has(file.filename)) {changedFiles.set(file.filename, {sha: file.sha, commitDate: new Date(commit.commit.committer.date), author: commit.commit.author.name});}}
                    }
                }
            }
            console.log(`Found ${changedFiles.size} ${notificationOnly ? 'files' : 'proposal files'} that changed`);
            let filesToNotify = Array.from(changedFiles.keys());
            if (trackedRepo.csvColumnTracking && changedFiles.size > 0) {
                const csvFilesWithColumnChanges: string[] = [];
                for (const [filePath, fileInfo] of changedFiles.entries()) {
                    if (ProposalParser.isCSVFile(filePath)) {
                        try {
                            const rawContent = await this.client.fetchRawFileContent(owner, repo, filePath, branch);
                            const currentHeaders = ProposalParser.parseCSVHeaders(rawContent);
                            const proposalId = `${owner}/${repo}/${filePath}`;
                            const existing = await ProposalModel.findOne({ proposalId });
                            
                            if (existing && existing.csvHeaders && currentHeaders) {
                                let changed = false;
                                if (trackedRepo.csvNewColumnOnly) {
                                    // Check if there are any new headers that weren't there before
                                    changed = currentHeaders.some(h => !existing.csvHeaders!.includes(h));
                                } else {
                                    changed = JSON.stringify(existing.csvHeaders) !== JSON.stringify(currentHeaders);
                                }

                                if (changed) {
                                    csvFilesWithColumnChanges.push(filePath);
                                    console.log(`CSV column change detected in ${filePath}`);
                                    console.log(`- Old headers: ${existing.csvHeaders.join(', ')}`);
                                    console.log(`- New headers: ${currentHeaders.join(', ')}`);
                                    
                                    // Update the model so we don't notify again for the same change
                                    if (notificationOnly) {
                                        existing.csvHeaders = currentHeaders;
                                        existing.lastCommitSha = fileInfo.sha;
                                        existing.lastCommitDate = fileInfo.commitDate;
                                        await existing.save();
                                    }
                                }
                            } 
                            else if (!existing && currentHeaders) {
                                csvFilesWithColumnChanges.push(filePath);
                                // If notificationOnly, create a minimal record to track headers
                                if (notificationOnly) {
                                    await ProposalModel.create({
                                        proposalId,
                                        owner,
                                        repo,
                                        branch,
                                        filePath,
                                        fileName: filePath.split('/').pop(),
                                        lastCommitSha: fileInfo.sha,
                                        lastCommitDate: fileInfo.commitDate,
                                        lastCommitAuthor: fileInfo.author,
                                        githubUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`,
                                        rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
                                        content: rawContent,
                                        contentMarkdown: rawContent,
                                        firstSeenAt: new Date(),
                                        lastUpdatedAt: new Date(),
                                        notified: true,
                                        updateCount: 0,
                                        csvHeaders: currentHeaders
                                    });
                                }
                            }
                        } 
                        catch (error) {console.error(`Error checking CSV headers for ${filePath}:`, error); csvFilesWithColumnChanges.push(filePath);}
                    } 
                    else {csvFilesWithColumnChanges.push(filePath);}
                }
                filesToNotify = csvFilesWithColumnChanges;
                console.log(`${filesToNotify.length} files have column changes (filtered from ${changedFiles.size} total changes)`);
            }
            if (filesToNotify.length > 0 && hasNewCommits && GITHUB_CONFIG.enableNotifications) {await this.sendQuickNotification(owner, repo, filesToNotify, branch, notificationOnly);}
            if (notificationOnly) {
                const proposalCount = 0;
                await RepoCheckModel.findOneAndUpdate({ owner, repo, branch }, {$set: { lastCheckAt: new Date(), lastCommitSha: latestCommitSha, lastCommitDate: new Date(commits[0].commit.committer.date), proposalCount, errorCount: 0, lastError: undefined } }, { upsert: true, new: true });
                if (changedFiles.size > 0) {console.log(`Notification sent for ${changedFiles.size} changed files`);}
                else {console.log('No relevant files changed');}
                return {newProposals: 0, updatedProposals: 0, totalChecked: changedFiles.size, proposals: []};
            }
            let newCount = 0;
            let updatedCount = 0;
            const savedProposals: IProposal[] = [];
            for (const [filePath, fileInfo] of changedFiles.entries()) {
                try {
                    const rawContent = await this.client.fetchRawFileContent(owner, repo, filePath, branch);
                    const parsed = ProposalParser.parse(rawContent, proposalType);
                    const proposalId = `${owner}/${repo}/${filePath}`;
                    const existing = await ProposalModel.findOne({ proposalId });
                    const githubUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`;
                    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
                    const csvHeaders = ProposalParser.isCSVFile(filePath) ? ProposalParser.parseCSVHeaders(rawContent) : undefined;
                    if (existing) {
                        if (existing.lastCommitSha !== fileInfo.sha) {
                            existing.lastCommitSha = fileInfo.sha;
                            existing.lastCommitDate = fileInfo.commitDate;
                            existing.lastCommitAuthor = fileInfo.author;
                            existing.content = rawContent;
                            existing.contentMarkdown = rawContent;
                            existing.lastUpdatedAt = new Date();
                            existing.updateCount += 1;
                            existing.notified = false;
                            if (csvHeaders) existing.csvHeaders = csvHeaders;
                            if (parsed.proposalNumber) existing.proposalNumber = parsed.proposalNumber;
                            if (parsed.title) existing.title = parsed.title;
                            if (parsed.status) existing.status = parsed.status;
                            if (parsed.author) existing.author = parsed.author;
                            if (parsed.created) existing.created = parsed.created;
                            if (parsed.type) existing.type = parsed.type;
                            if (parsed.category) existing.category = parsed.category;
                            if (parsed.summary) existing.summary = parsed.summary;
                            if (parsed.motivation) existing.motivation = parsed.motivation;
                            if (parsed.specification) existing.specification = parsed.specification;
                            await existing.save();
                            savedProposals.push(existing);
                            updatedCount++;
                            console.log(`Updated: ${parsed.proposalNumber || filePath}`);
                        } 
                        else {console.log(`Skipped (no changes): ${parsed.proposalNumber || filePath}`);}
                    } 
                    else {
                        const newProposal = await ProposalModel.create({
                        proposalId,
                        owner,
                        repo,
                        branch,
                        filePath,
                        fileName: filePath.split('/').pop(),
                        lastCommitSha: fileInfo.sha,
                        lastCommitDate: fileInfo.commitDate,
                        lastCommitAuthor: fileInfo.author,
                        proposalNumber: parsed.proposalNumber,
                        title: parsed.title,
                        status: parsed.status,
                        author: parsed.author,
                        created: parsed.created,
                        type: parsed.type,
                        category: parsed.category,
                        content: rawContent,
                        contentMarkdown: rawContent,
                        summary: parsed.summary,
                        motivation: parsed.motivation,
                        specification: parsed.specification,
                        githubUrl,
                        rawUrl,
                        firstSeenAt: new Date(),
                        lastUpdatedAt: new Date(),
                        notified: false,
                        updateCount: 0,
                        csvHeaders: csvHeaders || undefined
                        });
                        savedProposals.push(newProposal);
                        newCount++;
                        console.log(`   New proposal: ${parsed.proposalNumber || filePath}`);
                        if (GITHUB_CONFIG.enableNotifications) {await this.sendDetailedProposalNotification(newProposal, trackedRepo.disableTweetGeneration);}
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                } 
                catch (error) {console.error(`   Error processing ${filePath}:`, error);}
            }
            const proposalCount = await ProposalModel.countDocuments({ owner, repo });
            await RepoCheckModel.findOneAndUpdate({ owner, repo, branch }, {$set: { lastCheckAt: new Date(), lastCommitSha: latestCommitSha, lastCommitDate: new Date(commits[0].commit.committer.date), proposalCount, errorCount: 0, lastError: undefined } }, { upsert: true, new: true });
            console.log(`   ${newCount} new, ${updatedCount} updated proposals`);
            return {newProposals: newCount, updatedProposals: updatedCount, totalChecked: changedFiles.size, proposals: savedProposals};
        } 
        catch (error: any) {

            console.error(`Error checking ${owner}/${repo}:`, error);
            await RepoCheckModel.findOneAndUpdate({ owner, repo, branch }, { $set: { lastCheckAt: new Date(), lastError: error.message }, $inc: { errorCount: 1 } }, { upsert: true });
            throw error;
        }
    }

    private async sendQuickNotification(owner: string, repo: string, filePaths: string[], branch: string, notificationOnly: boolean = false): Promise<void> {
        try {
            const escapeMarkdown = (text: string): string => text.replace(/([_*\[\]()~`>#+=|{}.!])/g, '\\$1');
            const escapeLinkText = (text: string): string => text.replace(/([_*\[\]`])/g, '\\$1');
            let message = notificationOnly ? '📁 *Repository Update*\n\n' : '🔔 *Proposal Activity Detected*\n\n';
            message += `*${escapeMarkdown(owner)}/${escapeMarkdown(repo)}*\n\n`;
            filePaths.slice(0, 5).forEach(path => {
                const fileName = path.split('/').pop() || path;
                const url = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
                message += `• [${escapeLinkText(fileName)}](${url})\n`;
            });
            if (filePaths.length > 5) {message += `\n_\\.\\.\\. and ${filePaths.length - 5} more_\n`;}
            await telegramBot.sendMessage({text: message, parse_mode: 'Markdown', disable_web_page_preview: true});
            console.log('Sent quick notification');
        } 
        catch (error) {console.error('Error sending quick notification:', error);}
    }

    private async getTweetPerformanceContext(): Promise<string> {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const tweets = await Tweets.find({createdAt: { $gte: thirtyDaysAgo.toISOString() }, 'metrics.view_count': { $gt: 0 }}).sort({ 'performance.engagement_rate': -1 }).limit(10).lean();
            if (tweets.length === 0) {return 'No recent tweet data available.';}
            const avgEngagement = tweets.reduce((sum, t) => sum + (t.performance?.engagement_rate || 0), 0) / tweets.length;
            const avgLength = tweets.reduce((sum, t) => sum + (t.text?.length || 0), 0) / tweets.length;
            let context = 'YOUR TWEET PERFORMANCE DATA:\n\n';
            context += `Average engagement rate: ${(avgEngagement * 100).toFixed(2)}%\n`;
            context += `Optimal tweet length: ~${Math.round(avgLength)} characters\n\n`;
            context += 'YOUR TOP PERFORMING TWEETS (for style reference):\n\n';
            tweets.slice(0, 5).forEach((tweet, i) => {const engagement = tweet.performance?.engagement_rate || 0; context += `${i + 1}. "${tweet.text}" (${tweet.metrics?.like_count || 0} likes, ${(engagement * 100).toFixed(1)}% engagement)\n\n`;});
            return context;
        } 
        catch (error) {console.error('Error fetching tweet performance:', error); return 'Tweet performance data unavailable.';}
    }

    private async generateProposalTweet(proposal: IProposal): Promise<string | null> {
        try {
            console.log(`   🤖 Generating tweet for ${proposal.proposalNumber || proposal.fileName}...`);
            const performanceContext = await this.getTweetPerformanceContext();
            const tweetTextRaw = await queryGrok([{ role: 'system', content: githubSystemPrompt }, { role: 'user', content: githubUserPrompt(proposal, performanceContext) }], { model: 'grok-4-fast-reasoning', temperature: 0.7, searchMode: 'off' });
            const tweetText = typeof tweetTextRaw === 'string' ? tweetTextRaw : tweetTextRaw.responseContent;
            const cleanTweet = tweetText.replace(/^["']|["']$/g, '').replace(/^Tweet:\s*/i, '').trim();
            console.log(`   Generated tweet: "${cleanTweet.substring(0, 50)}..."`);
            return cleanTweet;
        } 
        catch (error) {console.error('Error generating proposal tweet:', error); return null;}
    }

    private async sendDetailedProposalNotification(proposal: IProposal, disableTweetGeneration?: boolean): Promise<void> {
        try {
            const escapeMarkdown = (text: string): string => text.replace(/([_*\[\]()~`>#+=|{}.!])/g, '\\$1');
            let message = '✨ *New Governance Proposal*\n\n';
            if (proposal.proposalNumber) {message += `*${escapeMarkdown(proposal.proposalNumber)}*`;}
            if (proposal.title) {const title = proposal.proposalNumber ? `: ${proposal.title}` : proposal.title; message += ` ${escapeMarkdown(title)}\n\n`;} else {message += '\n\n';}
            message += `📁 ${escapeMarkdown(proposal.owner)}/${escapeMarkdown(proposal.repo)}\n`;
            if (proposal.author) {message += `👤 ${escapeMarkdown(proposal.author)}\n`;}
            if (proposal.status) {const statusEmoji = this.getStatusEmoji(proposal.status); message += `${statusEmoji} ${escapeMarkdown(proposal.status)}\n`;}
            if (proposal.summary) {message += `\n📄 *Summary:*\n${escapeMarkdown(proposal.summary.substring(0, 300))}${proposal.summary.length > 300 ? '...' : ''}\n`;}
            if (!disableTweetGeneration) {
                const aiTweet = await this.generateProposalTweet(proposal);
                if (aiTweet) {message += `\n🐦 *Suggested Tweet:*\n\`\`\`\n${escapeMarkdown(aiTweet)}\n\`\`\`\n`;}
            }
            message += `\n[View Proposal](${proposal.githubUrl})`;
            await telegramBot.sendMessage({text: message, parse_mode: 'Markdown', disable_web_page_preview: false});
            console.log(`   📤 Sent detailed notification${disableTweetGeneration ? '' : ' with AI tweet'}`);
        } 
        catch (error) {console.error('Error sending detailed notification:', error);}
    }

    async checkAllRepositories(): Promise<{totalNew: number; totalUpdated: number; successCount: number; errorCount: number; repoResults: Array<{ owner: string; repo: string; newProposals: number; updatedProposals: number; error?: string }>;}> {
        console.log(`🚀 Starting GitHub proposal check for ${TRACKED_REPOS.filter(r => r.enabled !== false).length} repos...\n`);
        const enabledRepos = TRACKED_REPOS.filter(repo => repo.enabled !== false);
        let totalNew = 0;
        let totalUpdated = 0;
        let successCount = 0;
        let errorCount = 0;
        const repoResults: Array<{ owner: string; repo: string; newProposals: number; updatedProposals: number; error?: string }> = [];
        const allProposals: IProposal[] = [];
        for (const repo of enabledRepos) {
            try {
                const result = await this.checkRepository(repo);
                totalNew += result.newProposals;
                totalUpdated += result.updatedProposals;
                successCount++;
                repoResults.push({owner: repo.owner, repo: repo.repo, newProposals: result.newProposals, updatedProposals: result.updatedProposals});
                allProposals.push(...result.proposals);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } 
            catch (error: any) {errorCount++; repoResults.push({owner: repo.owner, repo: repo.repo, newProposals: 0, updatedProposals: 0, error: error.message});}
        }
        console.log('\nGitHub proposal check complete:');
        console.log(`   ${totalNew} new proposals`);
        console.log(`${totalUpdated} updated proposals`);
        console.log(`   ✓ ${successCount} repos checked successfully`);
        if (errorCount > 0) {console.log(`   ${errorCount} repos had errors`);}
        if (totalUpdated > 0 && GITHUB_CONFIG.enableNotifications) {const updatedProposals = allProposals.filter(p => p.updateCount > 0); await this.sendProposalNotification(updatedProposals, { totalNew: 0, totalUpdated });}
        return {totalNew, totalUpdated, successCount, errorCount, repoResults};
    }

    private async sendProposalNotification(proposals: IProposal[], summary: { totalNew: number; totalUpdated: number }): Promise<void> {
        try {
            if (proposals.length === 0) return;
            const message = this.formatProposalMessage(proposals, summary);
            await telegramBot.sendMessage({text: message, parse_mode: 'Markdown', disable_web_page_preview: false});
            const proposalIds = proposals.map(p => p._id);
            await ProposalModel.updateMany({ _id: { $in: proposalIds } }, { $set: { notified: true } });
            console.log(`   📤 Sent Telegram notification for ${proposals.length} proposals`);
        } 
        catch (error) {console.error('Error sending proposal notification:', error);}
    }

    private formatProposalMessage(proposals: IProposal[], summary: { totalNew: number; totalUpdated: number }): string {
        const escapeMarkdown = (text: string): string => text.replace(/([_*\[\]()~`>#+=|{}.!])/g, '\\$1');
        let message = '🏛️ *Governance Proposal Activity*\n\n';
        if (summary.totalNew > 0) {message += `✨ ${summary.totalNew} new proposal${summary.totalNew > 1 ? 's' : ''}\n`;}
        if (summary.totalUpdated > 0) {message += `🔄 ${summary.totalUpdated} updated proposal${summary.totalUpdated > 1 ? 's' : ''}\n`;}
        message += '\n';
        const proposalsByRepo = proposals.reduce((acc, proposal) => {const key = `${proposal.owner}/${proposal.repo}`; if (!acc[key]) acc[key] = []; acc[key].push(proposal); return acc;}, {} as Record<string, IProposal[]>);
        for (const [repoKey, repoProposals] of Object.entries(proposalsByRepo)) {
            message += `*${escapeMarkdown(repoKey)}*\n\n`;
            for (const proposal of repoProposals) {
                const isNew = proposal.updateCount === 0;
                const badge = isNew ? '✨ NEW' : '🔄 UPDATED';
                message += `${badge}\n`;
                if (proposal.proposalNumber) {message += `*${escapeMarkdown(proposal.proposalNumber)}*`;}
                if (proposal.title) {const title = proposal.proposalNumber ? `: ${proposal.title}` : proposal.title; message += ` ${escapeMarkdown(title)}\n`;} else {message += '\n';}
                if (proposal.author) {message += `👤 ${escapeMarkdown(proposal.author)}\n`;}
                if (proposal.status) {const statusEmoji = this.getStatusEmoji(proposal.status); message += `${statusEmoji} Status: ${escapeMarkdown(proposal.status)}\n`;}
                message += `\n[View on GitHub](${proposal.githubUrl})\n\n`;
            }
        }
        return message;
    }

    private getStatusEmoji(status: string): string {
        const statusLower = status.toLowerCase();
        if (statusLower.includes('draft')) return '📝';
        if (statusLower.includes('accepted') || statusLower.includes('approved')) return '✅';
        if (statusLower.includes('rejected') || statusLower.includes('declined')) return '❌';
        if (statusLower.includes('review') || statusLower.includes('voting')) return '🔍';
        if (statusLower.includes('implemented') || statusLower.includes('final')) return '🎉';
        return '📋';
    }

    async getRecentProposals(limit: number = 10): Promise<IProposal[]> {return await ProposalModel.find().sort({ lastUpdatedAt: -1 }).limit(limit).lean();}
    async getProposalsByStatus(status: string): Promise<IProposal[]> {return await ProposalModel.find({ status: new RegExp(status, 'i') }).sort({ lastUpdatedAt: -1 }).lean();}
  
    async getRepoStats(owner: string, repo: string): Promise<{totalProposals: number; statusBreakdown: Record<string, number>; recentProposals: number;}> {
        const proposals = await ProposalModel.find({ owner, repo }).lean();
        const statusBreakdown: Record<string, number> = {};
        for (const proposal of proposals) {const status = proposal.status || 'Unknown'; statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;}
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentProposals = proposals.filter(p => p.lastUpdatedAt >= thirtyDaysAgo).length;
        return {totalProposals: proposals.length, statusBreakdown, recentProposals};
    }

    async checkRateLimit(): Promise<void> {
        try {
            const rateLimit = await this.client.checkRateLimit();
            console.log('GitHub API Rate Limit:');
            console.log(`   Remaining: ${rateLimit.remaining}/${rateLimit.limit}`);
            console.log(`   Resets at: ${rateLimit.reset.toISOString()}`);
        } 
        catch (error) {console.error('Error checking rate limit:', error);}
    }
}

export const githubMonitor = new GitHubProposalMonitor();

export async function checkGitHubRepos() {
    console.log('🔄 Running scheduled GitHub proposal check...');
    try {const result = await githubMonitor.checkAllRepositories(); console.log('GitHub proposal check complete'); return result;} 
    catch (error) {console.error('Error in GitHub proposal check:', error); throw error;}
}

export { TRACKED_REPOS, GITHUB_CONFIG } from './config';
export { ProposalModel, RepoCheckModel } from './model';
export { GitHubAPIClient } from './fetcher';
export { ProposalParser } from './parser';