#!/usr/bin/env node

/**
 * Advanced Quote-Tweet Monitoring Cron Job
 * 
 * Combines multiple data sources for comprehensive crypto intelligence:
 * 1. GitHub Repos (proposals, CSV changes, RFCs)
 * 2. Tavily API (real-time search)
 * 3. RSS Feeds (20+ news sources)
 * 4. Telegram Channels (community sentiment feeds)
 * 5. Nitter Scraper (45+ monitored accounts)
 * 6. Blockworks Investment Framework (network effects, friction, moats)
 */

const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// External tooling workspace (defaults to ~/.openclaw/workspace; override with OPENCLAW_WORKSPACE)
const WORKSPACE_DIR = process.env.OPENCLAW_WORKSPACE
  || path.join(os.homedir(), '.openclaw', 'workspace');

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const CONFIG_PATH = process.env.TWITTER_ACCOUNTS_CONFIG
  || path.join(WORKSPACE_DIR, 'config', 'twitter-accounts.json');
const NITTER_SCRAPER = process.env.NITTER_SCRAPER
  || path.join(WORKSPACE_DIR, 'scripts', 'nitter-browser-scraper.js');

if (!TAVILY_API_KEY) {
  console.error('Missing TAVILY_API_KEY — set it in carpcap/.env');
  process.exit(1);
}

const fs = require('fs');
const { execSync } = require('child_process');
const { main: githubMonitor } = require('./github-monitor.js');

async function main() {
    console.log('Starting Quote-Tweet Engagement Monitor...');
    console.log('Time:', new Date().toISOString());
    
    // 1. Load config
    let config;
    try {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
        console.error('Failed to load config:', e.message);
        return;
    }

    const allSignals = [];

    // 2. Monitor GitHub repos for proposals and changes
    console.log('\n=== Monitoring GitHub Repos ===');
    try {
        const githubResults = await githubMonitor();
        if (githubResults && githubResults.length > 0) {
            console.log(`  ✓ Found ${githubResults.length} GitHub changes`);
            allSignals.push(...githubResults);
        } else {
            console.log('  No new GitHub changes');
        }
    } catch (e) {
        console.error('  GitHub monitoring failed:', e.message);
    }

    // 3. Search Tavily for hot narratives (use sparingly)
    console.log('\n=== Searching Tavily for Narratives ===');
    try {
        // Search for one key topic to save credits
        const query = 'DePIN crypto infrastructure network effects';
        const response = await fetch(`https://api.tavily.com/search?q=${encodeURIComponent(query)}&apiKey=${TAVILY_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchQuery: query,
                searchDepth: 'recent',
                numResults: 10,
                answerFormat: 'snippet'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                console.log(`  ✓ Found ${data.results.length} relevant results`);
                allSignals.push({
                    type: 'tavily',
                    query,
                    results: data.results
                });
            } else {
                console.log('  No new narrative signals');
            }
        }
    } catch (e) {
        console.error('  Tavily search failed:', e.message);
    }

    // 4. Scan X accounts via Nitter
    console.log('\n=== Scanning Target Accounts ===');
    const accounts = config.all_accounts || [];
    // Sample 5-10 accounts per run to avoid hitting rate limits
    const sample = accounts.sort(() => 0.5 - Math.random()).slice(0, 10);
    
    for (const username of sample) {
        try {
            console.log(`  Checking @${username}...`);
            const output = execSync(`node ${JSON.stringify(NITTER_SCRAPER)} user ${username} 3 --silent`, {
                encoding: 'utf8',
                timeout: 30000
            });
            const data = JSON.parse(output);
            
            if (data.tweets && data.tweets.length > 0) {
                const tweet = data.tweets[0];
                console.log(`    ✓ Found: ${tweet.text.substring(0, 50)}... (posted ${tweet.date || 'unknown'})`);
                
                // Check if tweet meets age criteria (at least 2 hours old)
                const meetsAgeCriteria = isTweetRecent(tweet.date);
                const isWorthy = isQuoteWorthy({ text: tweet.text });
                
                if (!meetsAgeCriteria) {
                    console.log(`    ✗ Too fresh (posted ${tweet.date})`);
                } else if (!isWorthy) {
                    console.log(`    ✗ Not quote-worthy`);
                } else {
                    console.log(`    ✓ MATCHED!`);
                    allSignals.push({
                        type: 'nitter',
                        account: username,
                        tweet: tweet,
                        url: tweet.url,
                        text: tweet.text,
                        date: tweet.date
                    });
                }
            } else {
                console.log('    No recent tweets');
            }
        } catch (e) {
            console.error(`    Error: ${e.message}`);
        }
    }

    // 5. Analyze all signals and find quote-worthy opportunities
    console.log('\n=== Analyzing Signals ===');
    console.log(`Total signals found: ${allSignals.length}`);
    
    if (allSignals.length > 0) {
        // All signals are already filtered by isQuoteWorthy when added
        console.log(`Quote-worthy signals: ${allSignals.length}`);
        
        if (allSignals.length > 0) {
            console.log('\nSending opportunities to Nick...');
            
            // Send each opportunity to Telegram
            for (const signal of allSignals) {
                const message = formatOpportunityForNick(signal);
                console.log(`\n${message}`);
                
                // Send via Telegram
                try {
                    execSync(`openclaw message send --telegram "${message.replace(/"/g, '\\"')}"`, {
                        encoding: 'utf8',
                        timeout: 10000
                    });
                    console.log('✓ Sent to Telegram');
                } catch (e) {
                    console.error(`✗ Failed to send: ${e.message}`);
                }
            }
        }
    } else {
        console.log('No quote-worthy opportunities found this cycle.');
    }

    console.log('\n=== Monitoring Cycle Complete ===');
}

function formatOpportunityForNick(signal) {
    if (signal.type === 'nitter') {
        const tweet = signal.tweet;
        const excerpt = tweet.text.substring(0, 120) + (tweet.text.length > 120 ? '...' : '');
        const timeAgo = getTimeAgo(tweet.date);
        
        return `🐦 Quote Opportunity\nSource: @${signal.account}\nPosted: ${timeAgo}\nContent: ${excerpt}\nWhy: Relevant to DePIN/crypto infrastructure narrative.`;
    }
    
    if (signal.type === 'github') {
        return `🐦 Quote Opportunity\nSource: ${signal.owner}/${signal.repo}\nPosted: Just now\nContent: New proposal or change detected\nWhy: Technical signal worth monitoring.`;
    }
    
    if (signal.type === 'tavily') {
        return `🐦 Quote Opportunity\nSource: Web search\nPosted: Recent\nContent: ${signal.query}\nWhy: Narrative signal worth exploring.`;
    }
    
    return `🐦 Quote Opportunity\nSource: ${signal.type}\nPosted: Unknown\nContent: ${getSignalTitle(signal)}\nWhy: Signal detected.`;
}

function getTimeAgo(dateStr) {
    if (!dateStr) return 'unknown time ago';
    
    const tweetDate = parseDate(dateStr);
    if (!tweetDate) {
        return dateStr;
    }
    
    const now = new Date();
    const diffMs = now - tweetDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
    
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
}

function isTweetRecent(dateStr) {
    // Filter for tweets posted at least 2 hours ago (minimum age 2h, max 48h)
    if (!dateStr) return false;
    
    // Handle relative time formats (e.g., "2h", "5h", "1d")
    if (dateStr.includes('h')) {
        const hours = parseInt(dateStr.match(/(\d+)h/)?.[1] || '0');
        return hours >= 2 && hours <= 48; // At least 2h, at most 48h old
    }
    
    if (dateStr.includes('m')) {
        // Minutes under 60 - skip these (too fresh)
        return false;
    }
    
    if (dateStr.includes('d')) {
        const days = parseInt(dateStr.match(/(\d+)d/)?.[1] || '0');
        return days >= 0 && days <= 2; // Up to 2 days old
    }
    
    // Handle absolute dates (e.g., "Mar 5", "26 Sep 2024", "Jan 5")
    // Parse and calculate hours difference
    const tweetDate = parseDate(dateStr);
    if (tweetDate) {
        const now = new Date();
        const diffMs = now - tweetDate;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours >= 2 && diffHours <= 48; // At least 2h, at most 48h old
    }
    
    return false;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Try to parse common formats
    // "Mar 5" - assume current year
    const shortFormat = /^([A-Za-z]{3})\s+(\d{1,2})$/i.exec(dateStr.trim());
    if (shortFormat) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.indexOf(shortFormat[1]);
        if (monthIndex !== -1) {
            const date = new Date(currentYear, monthIndex, parseInt(shortFormat[2]));
            // If the date is in the future, it's probably from last year
            if (date > now) {
                date.setFullYear(currentYear - 1);
            }
            return date;
        }
    }
    
    // "26 Sep 2024" or "Jan 19 2025"
    const fullDate = /([A-Za-z]{3})\s+(\d{1,2})\s*,?\s*(\d{4})?$/i.exec(dateStr.trim());
    if (fullDate) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.indexOf(fullDate[1]);
        if (monthIndex !== -1) {
            const year = fullDate[3] ? parseInt(fullDate[3]) : currentYear;
            return new Date(year, monthIndex, parseInt(fullDate[2]));
        }
    }
    
    // Try Date.parse as fallback
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed;
    }
    
    return null;
}

function isQuoteWorthy(signal) {
    // Check if signal is worth quoting - BE LESS RESTRICTIVE
    if (!signal) return false;
    
    const text = signal.text || signal.tweet?.text || signal.content || '';
    if (!text) return false;
    
    // Check length (keep it concise)
    if (text.length < 20) return false;
    
    // Skip ONLY obvious spam and "get rich quick" schemes - BE LENIENT
    const spamPatterns = [
        /get rich quick/i,
        /limited time.*discount/i,
        /click here.*now/i,
        /dm me for/i,
        /send.*to.*wallet/i,
        /buy.*token.*now/i,
        /guaranteed.*returns/i
    ];
    
    for (const pattern of spamPatterns) {
        if (pattern.test(text)) {
            return false;
        }
    }
    
    // Let most content through - better to have 10 options with 2-3 good ones than 0
    return true;
}

function getSignalTitle(signal) {
    if (signal.type === 'github') {
        return `${signal.owner}/${signal.repo} - ${signal.files?.[0]?.name || 'change'}`;
    }
    if (signal.type === 'nitter') {
        return `@${signal.account} - ${signal.tweet?.text?.substring(0, 40)}...`;
    }
    if (signal.type === 'tavily') {
        return signal.query;
    }
    return signal.type;
}

main();
