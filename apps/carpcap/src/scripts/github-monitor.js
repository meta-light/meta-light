#!/usr/bin/env node

/**
 * GitHub Repo Monitor for Content Ideas
 * 
 * Monitors GitHub repos for:
 * - New proposals (AEP, HIP, HRP, GIP)
 * - CSV file changes (new columns in fees_and_payments.csv)
 * - RFCs (malbeclabs/doublezero)
 * 
 * Used to find alpha and quote-worthy content
 * 
 * Rate limiting: 60 requests/hour (GitHub unauthenticated)
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

// External tooling workspace (defaults to ~/.openclaw/workspace; override with OPENCLAW_WORKSPACE)
const WORKSPACE_DIR = process.env.OPENCLAW_WORKSPACE
  || path.join(os.homedir(), '.openclaw', 'workspace');
const CONFIG_PATH = process.env.TWITTER_ACCOUNTS_CONFIG
  || path.join(WORKSPACE_DIR, 'config', 'twitter-accounts.json');
const CACHE_PATH = process.env.GITHUB_CACHE_PATH
  || path.join(WORKSPACE_DIR, '.github-cache.json');

// Rate limiting
let requestCount = 0;
const MAX_REQUESTS_PER_HOUR = 60;
const RESET_INTERVAL = 60 * 60 * 1000; // 1 hour

// Load config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const repos = config.github_repos?.filter(r => r.enabled) || [];

// Load cache or create new
let cache = {};
try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
} catch (e) {
    cache = { lastChecked: {}, files: {} };
}

/**
 * Fetch GitHub API endpoint with rate limiting
 */
async function fetchGitHub(url) {
    // Check rate limit
    requestCount++;
    if (requestCount > MAX_REQUESTS_PER_HOUR) {
        console.error('  Rate limit exceeded, skipping request');
        return null;
    }
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'OpenClaw-GitHub-Monitor',
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 429) {
                console.error('  GitHub rate limited, skipping');
            } else if (response.status === 403) {
                console.error('  GitHub 403, skipping');
            } else {
                console.error(`  GitHub API error: ${response.status}`);
            }
            return null;
        }
        
        return await response.json();
    } catch (error) {
        console.error(`  Fetch error: ${error.message}`);
        return null;
    }
}

/**
 * Check for new files matching pattern
 * Uses GitHub API to list commits instead of all files (more efficient)
 */
async function checkNewFiles(owner, repo, filePatterns) {
    const results = [];
    
    try {
        // Get recent commits to find modified files
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`;
        const commits = await fetchGitHub(apiUrl);
        
        if (!commits || !Array.isArray(commits)) return results;
        
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        
        for (const commit of commits) {
            if (commit.commit?.author?.date) {
                const commitDate = new Date(commit.commit.author.date).getTime();
                if (commitDate < oneDayAgo) {
                    // Only look at last 24 hours
                    break;
                }
            }
            
            // Get files in this commit
            if (!commit.files) continue;
            
            for (const file of commit.files) {
                // Check file pattern match
                const matchesPattern = filePatterns.some(pattern => {
                    const regex = new RegExp(
                        '^' + pattern
                            .replace(/\*/g, '.*')
                            .replace(/\?/g, '.') + '$'
                    );
                    return regex.test(file.filename);
                });
                
                if (!matchesPattern) continue;
                
                const fileKey = `${owner}/${repo}/${file.filename}`;
                const cached = cache.files[fileKey];
                
                // Check if new or updated
                if (!cached || cached.sha !== file.sha) {
                    const isNew = !cached;
                    
                    if (isNew || (commit.commit?.author?.date)) {
                        results.push({
                            path: file.filename,
                            url: file.raw_url || `https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}/${file.filename}`,
                            web_url: `https://github.com/${owner}/${repo}/blob/${commit.sha}/${file.filename}`,
                            sha: file.sha,
                            name: file.filename.split('/').pop(),
                            isNew,
                            commitDate: commit.commit?.author?.date
                        });
                        
                        // Update cache
                        cache.files[fileKey] = {
                            sha: file.sha,
                            lastChecked: now,
                            lastModified: new Date(commit.commit?.author?.date).getTime()
                        };
                    }
                }
            }
        }
        
        // Update last checked timestamp
        cache.lastChecked[`${owner}/${repo}`] = now;
        
    } catch (error) {
        console.error(`Error checking ${owner}/${repo}: ${error.message}`);
    }
    
    return results;
}

/**
 * Check for CSV column changes
 */
async function checkCSVColumns(owner, repo, filePath) {
    try {
        const apiUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            console.error(`  Failed to fetch CSV: ${response.status}`);
            return null;
        }
        
        const csv = await response.text();
        const lines = csv.split('\n');
        
        if (lines.length === 0) return null;
        
        const headers = lines[0].split(',').map(h => h.trim());
        const fileKey = `${owner}/${repo}/${filePath}`;
        const cachedColumns = cache.files[fileKey]?.columns;
        
        const newColumns = cachedColumns
            ? headers.filter(h => !cachedColumns.includes(h))
            : headers;
        
        if (newColumns.length > 0) {
            // Update cache
            cache.files[fileKey] = {
                ...cache.files[fileKey],
                columns: headers,
                lastChecked: Date.now()
            };
            
            return {
                filePath,
                url: `https://github.com/${owner}/${repo}/blob/main/${filePath}`,
                newColumns,
                totalColumns: headers.length
            };
        }
        
        // Update cache even if no new columns
        cache.files[fileKey] = {
            ...cache.files[fileKey],
            columns: headers,
            lastChecked: Date.now()
        };
        
    } catch (error) {
        console.error(`Error checking CSV ${owner}/${repo}/${filePath}: ${error.message}`);
    }
    
    return null;
}

/**
 * Get file content for analysis
 */
async function getFileContent(owner, repo, path) {
    try {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const file = await fetchGitHub(apiUrl);
        
        if (!file || file.type !== 'file') return null;
        
        // Decode base64 content
        const content = Buffer.from(file.content, 'base64').toString('utf8');
        return content;
    } catch (error) {
        console.error(`Error fetching content: ${error.message}`);
        return null;
    }
}

/**
 * Main monitoring function
 */
async function main() {
    console.log('GitHub Repo Monitor - Started');
    console.log(`Monitoring ${repos.length} repos\n`);
    
    const allResults = [];
    
    for (const repo of repos) {
        console.log(`Checking ${repo.owner}/${repo.repo}...`);
        
        if (repo.csvColumnTracking && repo.filePatterns?.some(p => p.includes('.csv'))) {
            const csvPattern = repo.filePatterns.find(p => p.includes('.csv'));
            if (csvPattern) {
                const csvFile = csvPattern.replace('*', '');
                console.log(`  Checking CSV columns: ${csvFile}`);
                
                const csvResult = await checkCSVColumns(repo.owner, repo.repo, csvFile);
                if (csvResult) {
                    console.log(`  ✓ Found ${csvResult.newColumns.length} new columns: ${csvResult.newColumns.join(', ')}`);
                    allResults.push({
                        type: 'csv-change',
                        owner: repo.owner,
                        repo: repo.repo,
                        ...csvResult,
                        proposalType: repo.proposalType
                    });
                } else {
                    console.log(`  No new columns`);
                }
            }
        } else if (repo.notificationOnly) {
            // Just list new files matching pattern
            const newFiles = await checkNewFiles(repo.owner, repo.repo, repo.filePatterns);
            if (newFiles.length > 0) {
                console.log(`  ✓ Found ${newFiles.length} new/updated files`);
                allResults.push({
                    type: 'notification',
                    owner: repo.owner,
                    repo: repo.repo,
                    files: newFiles,
                    proposalType: repo.proposalType
                });
            } else {
                console.log(`  No new files`);
            }
        } else {
            // Check for new proposals
            const newFiles = await checkNewFiles(repo.owner, repo.repo, repo.filePatterns);
            if (newFiles.length > 0) {
                console.log(`  ✓ Found ${newFiles.length} new/updated proposals`);
                
                // Fetch content for analysis
                const withContent = await Promise.all(
                    newFiles.map(async (file) => {
                        const content = await getFileContent(repo.owner, repo.repo, file.path);
                        return { ...file, content };
                    })
                );
                
                allResults.push({
                    type: 'proposal',
                    owner: repo.owner,
                    repo: repo.repo,
                    files: withContent,
                    proposalType: repo.proposalType
                });
            } else {
                console.log(`  No new proposals`);
            }
        }
    }
    
    // Save cache
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    
    console.log(`\nTotal changes found: ${allResults.length}`);
    
    // Return results for further processing
    return allResults;
}

// Run if called directly
if (require.main === module) {
    main().then(results => {
        console.log('\nGitHub monitoring complete.');
        if (results.length > 0) {
            console.log('\nSummary of changes:');
            results.forEach(r => {
                console.log(`  - ${r.type}: ${r.owner}/${r.repo}`);
                if (r.files) {
                    r.files.forEach(f => console.log(`    • ${f.name}`));
                }
            });
        }
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main, getFileContent };
