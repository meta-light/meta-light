import puppeteer, { Browser } from 'puppeteer';
import { existsSync } from 'fs';
import { platform } from 'os';
import { Tweet } from './model';

export interface TweetData {id: string; text: string; author: string; timestamp: string; url: string;}
export interface PuppeteerConfig {headless: boolean; args: string[]; timeout?: number; protocolTimeout?: number; retries?: number; executablePath?: string;}
const NITTER_INSTANCES = ['https://nitter.net', 'https://nitter.it'];
function extractTweetId(url: string): string | null {const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/); return match ? match[1] : null;}
function extractUsername(url: string): string | null {const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/\d+/); return match ? match[1] : null;}

function isLocalEnvironment(): boolean {
  if (process.env.PUPPETEER_ENV === 'local') return true;
  if (process.env.PUPPETEER_ENV === 'cloud') return false;
  const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  const isContainer = !!(process.env.DOCKER_CONTAINER || process.env.KUBERNETES_SERVICE_HOST);
  console.log('Environment Detection:', {
    NODE_ENV: process.env.NODE_ENV,
    PUPPETEER_ENV: process.env.PUPPETEER_ENV,
    platform: platform(),
    isRailway,
    isContainer,
    hasChromium: existsSync('/usr/bin/chromium'),
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    DOCKER_CONTAINER: process.env.DOCKER_CONTAINER
  });
  if (isRailway) {
    console.log('Railway environment detected, using cloud configuration');
    return false;
  }
  return (process.env.NODE_ENV === 'development' || 
          platform() === 'darwin' || 
          platform() === 'win32' || 
          !existsSync('/usr/bin/chromium'));
}
export const getLocalPuppeteerConfig = (): PuppeteerConfig => ({
  headless: true,
  timeout: 30000,
  protocolTimeout: 60000,
  retries: 3,
  executablePath: undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--no-default-browser-check',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors'
  ]
});

export const getCloudPuppeteerConfig = (): PuppeteerConfig => ({
  headless: true,
  timeout: 60000,
  protocolTimeout: 120000,
  retries: 3,
  executablePath: undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--no-zygote',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--metrics-recording-only',
    '--hide-scrollbars',
    '--mute-audio',
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor',
    '--disable-features=TranslateUI',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-threaded-animation',
    '--disable-threaded-compositing',
    '--disable-new-content-rendering-timeout',
    '--disable-chromium-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--disable-logging',
    '--silent',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--disable-plugins-discovery',
    '--disable-reading-from-canvas',
    '--disable-shared-workers',
    '--disable-threaded-scrolling',
    '--disable-compositor-touch-hit-testing',
    '--disable-image-animation-resync',
    '--disable-partial-raster',
    '--disable-skia-runtime-opts',
    '--disable-smooth-scrolling',
    '--disable-features=VizHitTestSurfaceLayer',
    '--disable-features=VizHitTestDrawQuad',
    '--aggressive-cache-discard',
    '--disable-extensions-file-access-check',
    '--disable-extensions-http-throttling',
    '--memory-pressure-off',
    '--max_old_space_size=4096'
  ]
});

export const getRailwayPuppeteerConfig = (): PuppeteerConfig => ({
  headless: true,
  timeout: 60000,
  protocolTimeout: 120000,
  retries: 5,
  executablePath: undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--single-process',
    '--no-zygote',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-ipc-flooding-protection',
    '--disable-hang-monitor',
    '--disable-breakpad',
    '--disable-domain-reliability',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--disable-extensions',
    '--disable-threaded-animation',
    '--disable-threaded-compositing',
    '--disable-new-content-rendering-timeout',
    '--disable-chromium-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--disable-logging',
    '--silent',
    '--no-first-run',
    '--hide-scrollbars',
    '--mute-audio',
    '--disable-default-apps',
    '--disable-plugins-discovery',
    '--disable-reading-from-canvas',
    '--disable-shared-workers',
    '--disable-threaded-scrolling',
    '--disable-compositor-touch-hit-testing',
    '--disable-image-animation-resync',
    '--disable-partial-raster',
    '--disable-skia-runtime-opts',
    '--disable-smooth-scrolling',
    '--disable-features=VizHitTestSurfaceLayer',
    '--disable-features=VizHitTestDrawQuad',
    '--aggressive-cache-discard',
    '--disable-extensions-file-access-check',
    '--disable-extensions-http-throttling',
    '--memory-pressure-off',
    '--max_old_space_size=4096',
    '--user-data-dir=/tmp/chrome-user-data-dir',
    '--disk-cache-dir=/tmp/chrome-cache',
    '--disable-background-mode',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-threaded-animation',
    '--disable-threaded-compositing',
    '--disable-new-content-rendering-timeout',
    '--disable-chromium-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--disable-logging',
    '--silent',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--disable-plugins-discovery',
    '--disable-reading-from-canvas',
    '--disable-shared-workers',
    '--disable-threaded-scrolling',
    '--disable-compositor-touch-hit-testing',
    '--disable-image-animation-resync',
    '--disable-partial-raster',
    '--disable-skia-runtime-opts',
    '--disable-smooth-scrolling',
    '--disable-features=VizHitTestSurfaceLayer',
    '--disable-features=VizHitTestDrawQuad',
    '--aggressive-cache-discard',
    '--disable-extensions-file-access-check',
    '--disable-extensions-http-throttling',
    '--memory-pressure-off',
    '--max_old_space_size=4096',
    '--user-data-dir=/tmp/chrome-user-data-dir',
    '--disk-cache-dir=/tmp/chrome-cache',
    '--disable-background-mode',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-threaded-animation',
    '--disable-threaded-compositing',
    '--disable-new-content-rendering-timeout',
    '--disable-chromium-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--disable-logging',
    '--silent',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--disable-plugins-discovery',
    '--disable-reading-from-canvas',
    '--disable-shared-workers',
    '--disable-threaded-scrolling',
    '--disable-compositor-touch-hit-testing',
    '--disable-image-animation-resync',
    '--disable-partial-raster',
    '--disable-skia-runtime-opts',
    '--disable-smooth-scrolling',
    '--disable-features=VizHitTestSurfaceLayer',
    '--disable-features=VizHitTestDrawQuad',
    '--aggressive-cache-discard',
    '--disable-extensions-file-access-check',
    '--disable-extensions-http-throttling',
    '--memory-pressure-off',
    '--max_old_space_size=4096'
  ]
});

export const getUltraRailwayPuppeteerConfig = (): PuppeteerConfig => ({
  headless: true,
  timeout: 90000,
  protocolTimeout: 180000,
  retries: 3,
  executablePath: undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-features=AudioServiceOutOfProcess',
    '--disable-threaded-animation',
    '--disable-threaded-compositing',
    '--disable-new-content-rendering-timeout',
    '--disable-chromium-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--disable-logging',
    '--silent',
    '--hide-scrollbars',
    '--mute-audio',
    '--user-data-dir=/tmp/chrome-user-data-dir',
    '--disk-cache-dir=/tmp/chrome-cache',
    '--disable-background-mode',
    '--disable-component-extensions-with-background-pages',
    '--disable-sync',
    '--disable-translate',
    '--no-default-browser-check',
    '--disable-domain-reliability',
    '--disable-component-update',
    '--disable-plugins-discovery',
    '--disable-reading-from-canvas',
    '--disable-shared-workers',
    '--disable-threaded-scrolling',
    '--disable-compositor-touch-hit-testing',
    '--disable-image-animation-resync',
    '--disable-partial-raster',
    '--disable-skia-runtime-opts',
    '--disable-smooth-scrolling',
    '--disable-features=VizHitTestSurfaceLayer',
    '--disable-features=VizHitTestDrawQuad',
    '--aggressive-cache-discard',
    '--disable-extensions-file-access-check',
    '--disable-extensions-http-throttling',
    '--memory-pressure-off',
    '--max_old_space_size=2048'
  ]
});

export const getPuppeteerConfig = (): PuppeteerConfig => {
  const isLocal = isLocalEnvironment();
  const isRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
  if (isLocal) {return getLocalPuppeteerConfig();} 
  else if (isRailway) {
    console.log('Using ultra Railway configuration with Chromium for better resource management');
    return getUltraRailwayPuppeteerConfig();
  } 
  else {return getCloudPuppeteerConfig();}
};

export async function launchBrowserWithRetry(config?: Partial<PuppeteerConfig>): Promise<Browser> {
  const fullConfig = { ...getPuppeteerConfig(), ...config };
  let lastError: Error | null = null;
  const executablePaths = fullConfig.executablePath ? [fullConfig.executablePath] : ['/usr/bin/chromium', undefined];
  console.log(`Attempting to launch browser with ${fullConfig.retries} retries...`);
  console.log(`Executable paths to try: ${executablePaths.map(p => p || 'auto-detect').join(', ')}`);
  for (let attempt = 1; attempt <= (fullConfig.retries || 3); attempt++) {
    console.log(`\n--- Attempt ${attempt}/${fullConfig.retries || 3} ---`);
    for (const execPath of executablePaths) {
      try {
        console.log(`Trying executable path: ${execPath || 'auto-detect'}`);
        const launchOptions: any = {
          headless: fullConfig.headless, 
          args: fullConfig.args, 
          timeout: fullConfig.timeout, 
          protocolTimeout: fullConfig.protocolTimeout, 
          executablePath: execPath, 
          ignoreDefaultArgs: ['--disable-extensions'], 
          dumpio: false
        };
        if (!isLocalEnvironment()) {
          launchOptions.pipe = false; 
          launchOptions.ignoreHTTPSErrors = true; 
          launchOptions.devtools = false;
          const railwayArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--user-data-dir=/tmp/chrome-user-data-dir',
            '--disk-cache-dir=/tmp/chrome-cache',
            '--disable-background-mode',
            '--disable-default-apps',
            '--no-first-run',
            '--no-default-browser-check'
          ];
          launchOptions.args = [...launchOptions.args, ...railwayArgs];
        }
        console.log(`Launching with ${launchOptions.args.length} arguments...`);
        const browser = await puppeteer.launch(launchOptions);
        console.log(`✓ Browser launched successfully with ${execPath || 'auto-detect'}`);
        return browser;
      } 
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`✗ Browser launch failed with ${execPath || 'auto-detect'}:`, lastError.message);
        if (lastError.message.includes('posix_spawn') || 
            lastError.message.includes('Cannot fork') || 
            lastError.message.includes('EAGAIN') ||
            lastError.message.includes('Resource temporarily unavailable')) {
          console.log('⚠️  Detected Railway/container resource issue, trying ultra-restrictive mode...');
          try {
            const ultraRestrictiveArgs = [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--single-process',
              '--no-zygote',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-features=AudioServiceOutOfProcess',
              '--disable-ipc-flooding-protection',
              '--disable-hang-monitor',
              '--disable-breakpad',
              '--disable-component-extensions-with-background-pages',
              '--disable-domain-reliability',
              '--disable-background-networking',
              '--disable-sync',
              '--disable-translate',
              '--disable-extensions',
              '--run-all-compositor-stages-before-draw',
              '--disable-threaded-animation',
              '--disable-threaded-compositing',
              '--disable-new-content-rendering-timeout',
              '--disable-chromium-sandbox',
              '--user-data-dir=/tmp/chrome-user-data-dir',
              '--disk-cache-dir=/tmp/chrome-cache',
              '--disable-background-mode',
              '--disable-default-apps',
              '--no-first-run',
              '--no-default-browser-check',
              '--silent',
              '--disable-logging',
              '--disable-features=TranslateUI',
              '--disable-features=AudioServiceOutOfProcess',
              '--disable-threaded-animation',
              '--disable-threaded-compositing',
              '--disable-new-content-rendering-timeout',
              '--disable-chromium-sandbox',
              '--run-all-compositor-stages-before-draw',
              '--disable-logging',
              '--silent',
              '--disable-domain-reliability',
              '--disable-component-update',
              '--disable-plugins-discovery',
              '--disable-reading-from-canvas',
              '--disable-shared-workers',
              '--disable-threaded-scrolling',
              '--disable-compositor-touch-hit-testing',
              '--disable-image-animation-resync',
              '--disable-partial-raster',
              '--disable-skia-runtime-opts',
              '--disable-smooth-scrolling',
              '--disable-features=VizHitTestSurfaceLayer',
              '--disable-features=VizHitTestDrawQuad',
              '--aggressive-cache-discard',
              '--disable-extensions-file-access-check',
              '--disable-extensions-http-throttling',
              '--memory-pressure-off',
              '--max_old_space_size=2048'
            ];
            console.log(`Trying ultra-restrictive mode with ${ultraRestrictiveArgs.length} arguments...`);
            const ultraBrowser = await puppeteer.launch({
              headless: true, 
              args: ultraRestrictiveArgs, 
              timeout: 60000, 
              protocolTimeout: 120000, 
              executablePath: execPath, 
              pipe: false, 
              dumpio: false, 
              ignoreDefaultArgs: true
            });
            console.log('✓ Ultra-restrictive mode succeeded!');
            return ultraBrowser;
          } 
          catch (ultraError) {
            console.error(`✗ Ultra-restrictive launch also failed:`, ultraError instanceof Error ? ultraError.message : String(ultraError));
          }
        }
      }
    }
    if (attempt < (fullConfig.retries || 3)) {
      const delay = attempt * 2000; 
      console.log(`⏳ Waiting ${delay}ms before next attempt...`); 
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  console.error(`Failed to launch browser after ${fullConfig.retries} attempts.`);
  console.error(`Last error: ${lastError?.message}`);
  throw new Error(`Failed to launch browser after ${fullConfig.retries} attempts. Last error: ${lastError?.message}`);
}

export async function safeCloseBrowser(browser: Browser | null | undefined): Promise<void> {
  if (!browser) return;
  try {await browser.close();} 
  catch (error) {console.error('Error closing browser:', error instanceof Error ? error.message : String(error));}
}

export async function scrapeIndividualTweets(tweetUrls: string[]): Promise<TweetData[]> {
  const tweets: TweetData[] = [];
  for (const url of tweetUrls) {
    const tweetId = extractTweetId(url);
    const username = extractUsername(url);
    if (!tweetId || !username) continue;
    for (const nitterInstance of NITTER_INSTANCES) {
      try {
        const nitterUrl = `${nitterInstance}/${username}/status/${tweetId}`;
        const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
        const page = await browser.newPage();
        await page.goto(nitterUrl, { timeout: 10000 });
        await page.waitForSelector('.tweet-content', { timeout: 5000 });
        const text = await page.$eval('.tweet-content', el => el.textContent?.trim() || '');
        const timestamp = await page.$eval('.tweet-date a', el => el.textContent?.trim() || '').catch(() => '');
        await browser.close();
        if (text) {tweets.push({ id: tweetId, text, author: username, timestamp, url }); break;}
      } 
      catch (error) {console.log(`Failed ${nitterInstance}`); continue;}
    }
  }
  return tweets;
}

export interface XTweetMetrics {like_count: number | null; retweet_count: number | null; reply_count: number | null; quote_count: number | null; view_count: number | null;}
export interface XTweetItem {id: string; created_at: string | null; tweet: string | null; metrics?: XTweetMetrics; permalink: string | null; quotedTweet?: XTweetItem;}
export interface XProfileStats {tweets: number; following: number; followers: number; likes: number;}
export interface XProfileData {screenName: string; displayName: string; bio: string | null; location: string | null; website: string | null; joinDate: string | null; stats: XProfileStats; tweets: XTweetItem[];}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {return value;}
    if (typeof value === 'string') {const digitsOnly = value.replace(/[^0-9]/g, ''); if (digitsOnly.length === 0) {return null;} const parsed = Number(digitsOnly); return Number.isFinite(parsed) ? parsed : null;}
    return null;
}

function convertToISOString(dateString: string | null): string | null {
    if (!dateString) return null;
    try {
        const format1Match = dateString.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+·\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s+(UTC)$/);
        if (format1Match) {
            const [, month, day, year, hour, minute, ampm, timezone] = format1Match;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.indexOf(month);
            let hour24 = parseInt(hour);
            if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
            if (ampm === 'AM' && hour24 === 12) hour24 = 0;
            const date = new Date(parseInt(year), monthIndex, parseInt(day), hour24, parseInt(minute));
            if (!isNaN(date.getTime())) {return date.toISOString();}
        }
        const format2Match = dateString.match(/^(\d{1,2}):(\d{2})\s+(AM|PM)\s+-\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
        if (format2Match) {
            const [, hour, minute, ampm, day, month, year] = format2Match;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.indexOf(month);
            let hour24 = parseInt(hour);
            if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
            if (ampm === 'AM' && hour24 === 12) hour24 = 0;
            const date = new Date(parseInt(year), monthIndex, parseInt(day), hour24, parseInt(minute));
            if (!isNaN(date.getTime())) {return date.toISOString();}
        }
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {return parsedDate.toISOString();} 
    } 
    catch (error) {console.log('Could not parse date:', dateString, 'Error:', error);}
    return dateString;
}

function extractProfileStats(html: string): XProfileStats {
    const stats: XProfileStats = {tweets: 0, following: 0, followers: 0, likes: 0};
    let tweetsMatch = html.match(/class="posts">\s*<span class="profile-stat-header">Tweets<\/span>\s*<span class="profile-stat-num">([\d,]+)<\/span>/);
    if (tweetsMatch) {stats.tweets = toNumber(tweetsMatch[1]) || 0;}
    let followingMatch = html.match(/class="following">\s*<span class="profile-stat-header">Following<\/span>\s*<span class="profile-stat-num">([\d,]+)<\/span>/);
    if (followingMatch) {stats.following = toNumber(followingMatch[1]) || 0;}
    let followersMatch = html.match(/class="followers">\s*<span class="profile-stat-header">Followers<\/span>\s*<span class="profile-stat-num">([\d,]+)<\/span>/);
    if (followersMatch) {stats.followers = toNumber(followersMatch[1]) || 0;}
    let likesMatch = html.match(/class="likes">\s*<span class="profile-stat-header">Likes<\/span>\s*<span class="profile-stat-num">([\d,]+)<\/span>/);
    if (likesMatch) {stats.likes = toNumber(likesMatch[1]) || 0;}
    if (stats.tweets === 0 && stats.following === 0 && stats.followers === 0 && stats.likes === 0) {
        const statsMatch = html.match(/Markdown Content:\s*([\s\S]*?)(?=\s*={20,}|$)/);
        if (statsMatch) {
            const content = statsMatch[1];
            const followerMatch = content.match(/(\d{1,3}(?:,\d{3})*)\s*followers?/i);
            if (followerMatch) {stats.followers = toNumber(followerMatch[1]) || 0;}
            const followingMatch = content.match(/(\d{1,3}(?:,\d{3})*)\s*following/i);
            if (followingMatch) {stats.following = toNumber(followingMatch[1]) || 0;}
            const tweetMatch = content.match(/(\d{1,3}(?:,\d{3})*)\s*tweets?/i);
            if (tweetMatch) {stats.tweets = toNumber(tweetMatch[1]) || 0;}
        }
    }
    return stats;
}

function extractProfileInfo(html: string): {displayName: string; bio: string | null; location: string | null; website: string | null; joinDate: string | null;} {
    let displayName = '';
    let bio: string | null = null;
    let location: string | null = null;
    let website: string | null = null;
    let joinDate: string | null = null;
    let nameMatch = html.match(/class="profile-card-fullname"[^>]*>([^<]+)/);
    if (nameMatch) {displayName = nameMatch[1].trim();}
    let bioMatch = html.match(/class="profile-bio">\s*<p[^>]*>([^<]+)<\/p>/);
    if (bioMatch) {bio = bioMatch[1].trim();} 
    else {bioMatch = html.match(/class="profile-bio">\s*<p[^>]*>([\s\S]*?)<\/p>/); if (bioMatch) {bio = cleanHtmlTags(bioMatch[1]).trim();}}
    let locationMatch = html.match(/class="profile-location">\s*<span>[^<]*<div[^>]*>.*?<\/div>\s*<\/span>\s*<span>([^<]+)<\/span>/);
    if (locationMatch) {location = locationMatch[1].trim();}
    let websiteMatch = html.match(/class="profile-website">\s*<span>[^<]*<div[^>]*>.*?<\/div>\s*<a[^>]*>([^<]+)<\/a>/);
    if (websiteMatch) {website = websiteMatch[1].trim();}
    else {const hrefMatch = html.match(/class="profile-website">\s*<span>[^<]*<a[^>]*href="([^"]+)"/); if (hrefMatch) {website = hrefMatch[1].trim();}}
    let joinMatch = html.match(/class="profile-joindate">\s*<span[^>]*title="([^"]+)"/);
    if (joinMatch) {joinDate = joinMatch[1].trim();} 
    else {joinMatch = html.match(/class="profile-joindate">\s*<span[^>]*>([^<]*Joined\s+([^<]+))</); if (joinMatch) {joinDate = joinMatch[1].trim();}}
    if (joinDate) {joinDate = convertToISOString(joinDate);}
    if (!displayName && !bio && !location && !website && !joinDate) {
        const titleMatch = html.match(/Title:\s*([^\n]+)/);
        if (titleMatch) {const title = titleMatch[1].trim(); const nameMatch = title.match(/^([^(]+)/); if (nameMatch) {displayName = nameMatch[1].trim();}}
        const contentMatch = html.match(/Markdown Content:\s*([\s\S]*?)(?=\s*={20,}|$)/);
        if (contentMatch) {
            const content = contentMatch[1];
            const lines = content.split('\n').filter(line => line.trim().length > 20 && !line.includes('Pinned Tweet') && !line.includes('@') && !line.includes('http'));
            if (lines.length > 0) {bio = lines[0].trim();}
        }
    }
    return {displayName, bio, location, website, joinDate};
}

function extractTweetsFromHtml(html: string, screenName: string): XTweetItem[] {
    const tweets: XTweetItem[] = [];
    if (html.includes('Markdown Content:')) {return extractTweetsFromProcessedContent(html, screenName);}
    const timelineItemStarts = html.matchAll(/<div[^>]*class="[^"]*timeline-item[^"]*"[^>]*>/g);
    const matches = Array.from(timelineItemStarts);
    for (let i = 0; i < matches.length; i++) {
        const startIndex = matches[i].index!;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index! : html.length;
        const tweetHtml = html.substring(startIndex, endIndex);
        if (tweetHtml.includes('pinned')) {continue;}
        if (tweetHtml.includes('retweet-header')) {continue;}
        const tweetIdMatch = tweetHtml.match(/href="[^"]*\/status\/(\d+)/);
        if (!tweetIdMatch) continue;
        const tweetId = tweetIdMatch[1];
        let tweet: string | null = null;
        const textMatch = tweetHtml.match(/<div[^>]*class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
        if (textMatch) {tweet = cleanHtmlTags(textMatch[1]);}
        if (!tweet || tweet.trim().length === 0) {const allTextMatch = tweetHtml.match(/<div[^>]*class="[^"]*tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/); if (allTextMatch) {tweet = cleanHtmlTags(allTextMatch[1]);}}
        if (!tweet || tweet.trim().length === 0) {
            const anyContentMatch = tweetHtml.match(/<div[^>]*class="[^"]*[^"]*"[^>]*>([^<]+)<\/div>/);
            if (anyContentMatch) {const potentialText = anyContentMatch[1].trim(); if (potentialText.length > 10 && !potentialText.includes('@') && !potentialText.includes('http')) {tweet = potentialText;}}
        }
        const metrics = extractMetricsFromHtml(tweetHtml);
        let created_at: string | null = null;
        const dateMatch = tweetHtml.match(/class="tweet-date"[^>]*>[^<]*<a[^>]*title="([^"]+)"/);
        if (dateMatch) {created_at = dateMatch[1].trim();} 
        else {const altDateMatch = tweetHtml.match(/class="tweet-date"[^>]*>([^<]+)</); if (altDateMatch) {created_at = altDateMatch[1].trim();}}
        created_at = convertToISOString(created_at);
        let quotedTweet: XTweetItem | undefined = undefined;
        const quoteMatch = tweetHtml.match(/<div[^>]*class="[^"]*quote[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
        if (quoteMatch) {quotedTweet = extractQuotedTweet(quoteMatch[1], tweetHtml);}
        const tweetItem: XTweetItem = {id: tweetId, tweet, created_at, metrics, permalink: `https://x.com/${screenName}/status/${tweetId}`, quotedTweet};
        tweets.push(tweetItem);
    }
    return tweets;
}

function cleanHtmlTags(html: string): string {
    let cleaned = html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/&[a-zA-Z]+;/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function extractQuotedTweet(quoteHtml: string, fullTweetHtml: string): XTweetItem | undefined {
    try {
        const quoteLinkMatch = fullTweetHtml.match(/<a[^>]*class="quote-link"[^>]*href="[^"]*\/status\/(\d+)/);
        if (!quoteLinkMatch) return undefined;
        const quotedTweetId = quoteLinkMatch[1];
        const authorMatch = quoteHtml.match(/<a[^>]*class="username"[^>]*title="@([^"]+)"/);
        let quotedScreenName = authorMatch ? authorMatch[1] : 'unknown';
        let quotedText: string | null = null;
        const quotedTextMatch = quoteHtml.match(/<div[^>]*class="quote-text"[^>]*dir="auto">([\s\S]*?)<\/div>/);
        if (quotedTextMatch) {quotedText = cleanHtmlTags(quotedTextMatch[1]);}
        let quotedDate: string | null = null;
        const quotedDateMatch = quoteHtml.match(/class="tweet-date"[^>]*>[^<]*<a[^>]*title="([^"]+)"/);
        if (quotedDateMatch) {quotedDate = convertToISOString(quotedDateMatch[1].trim());}
        return {id: quotedTweetId, tweet: quotedText, created_at: quotedDate, permalink: `https://x.com/${quotedScreenName}/status/${quotedTweetId}`};
    } 
    catch (error) {console.log('Error extracting quoted tweet:', error); return undefined;}
}

function extractMetricsFromHtml(tweetHtml: string): XTweetMetrics {
    const metrics: XTweetMetrics = {like_count: null, retweet_count: null, reply_count: null, quote_count: null, view_count: null};
    const statsMatch = tweetHtml.match(/<div[^>]*class="[^"]*tweet-stats[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    if (!statsMatch) return metrics;
    const statsHtml = statsMatch[1];
    const likeMatch = statsHtml.match(/icon-heart[^>]*>.*?<\/span>\s*([^<]*)<\/div>/);
    if (likeMatch) {const likeText = likeMatch[1].trim(); if (likeText && likeText !== '') {metrics.like_count = toNumber(likeText);}}
    const retweetMatch = statsHtml.match(/icon-retweet[^>]*>.*?<\/span>\s*([^<]*)<\/div>/);
    if (retweetMatch) {const retweetText = retweetMatch[1].trim(); if (retweetText && retweetText !== '') {metrics.retweet_count = toNumber(retweetText);}}
    const replyMatch = statsHtml.match(/icon-comment[^>]*>.*?<\/span>\s*([^<]*)<\/div>/);
    if (replyMatch) {const replyText = replyMatch[1].trim(); if (replyText && replyText !== '') {metrics.reply_count = toNumber(replyText);}}
    const quoteMatch = statsHtml.match(/icon-quote[^>]*>.*?<\/span>\s*([^<]*)<\/div>/);
    if (quoteMatch) {const quoteText = quoteMatch[1].trim(); if (quoteText && quoteText !== '') {metrics.quote_count = toNumber(quoteText);}}
    return metrics;
}

function extractTweetsFromProcessedContent(html: string, screenName: string): XTweetItem[] {
    const tweets: XTweetItem[] = [];
    const contentMatch = html.match(/Markdown Content:\s*([\s\S]*?)(?=\s*={20,}|$)/);
    if (!contentMatch) {return tweets;}
    const content = contentMatch[1];
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    let currentTweet: Partial<XTweetItem> | null = null;
    let tweetIndex = 0;
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === 'Pinned Tweet') {continue;}
        if (trimmedLine.includes('retweeted')) {continue;}
        if (trimmedLine.length > 20 && !trimmedLine.startsWith('@') && !trimmedLine.startsWith('http') && !trimmedLine.includes('Pinned Tweet')) {
            if (currentTweet) {if (currentTweet.tweet && currentTweet.tweet.length > 0) {tweets.push(currentTweet as XTweetItem);}}
            let tweetId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const lineIndex = lines.indexOf(line);
            const nearbyLines = lines.slice(Math.max(0, lineIndex - 2), lineIndex + 3);
            const nearbyContent = nearbyLines.join(' ');
            const tweetIdMatch = nearbyContent.match(/\/status\/(\d+)/);
            if (tweetIdMatch) {tweetId = tweetIdMatch[1];}
            currentTweet = {
                id: tweetId,
                tweet: trimmedLine,
                created_at: null,
                metrics: {like_count: null, retweet_count: null, reply_count: null, quote_count: null, view_count: null},
                permalink: tweetId.startsWith('temp_') ? null : `https://x.com/${screenName}/status/${tweetId}`,
            };
            tweetIndex++;
        }
    }
    if (currentTweet && currentTweet.tweet && currentTweet.tweet.length > 0) {tweets.push(currentTweet as XTweetItem);}
    return tweets;
}

async function enrichWithViewCounts(tweets: XTweetItem[], screenName: string): Promise<XTweetItem[]> {
    const MAX_CONCURRENT = 3;
    const enrichedTweets: XTweetItem[] = [];
    for (let i = 0; i < tweets.length; i += MAX_CONCURRENT) {
        const batch = tweets.slice(i, i + MAX_CONCURRENT);
        const batchPromises = batch.map(async (tweet, batchIndex) => {
            const overallIndex = i + batchIndex;
            if (tweet.id.startsWith('temp_')) {console.log(`Skipping temporary ID tweet: ${tweet.id}`); return tweet;}
            try {
                const viewCount = await getViewCountFromTwitter(screenName, tweet.id);
                if (viewCount !== null && tweet.metrics) {tweet.metrics.view_count = viewCount;} 
                else {console.log(`Tweet ${overallIndex + 1}/${tweets.length} - No view count found for ${tweet.id}`);}
            } 
            catch (error) {console.log(`Tweet ${overallIndex + 1}/${tweets.length} - Error getting view count for ${tweet.id}: ${error}`);}
            return tweet;
        });
        const batchResults = await Promise.all(batchPromises);
        enrichedTweets.push(...batchResults);
        if (i + MAX_CONCURRENT < tweets.length) {await new Promise(resolve => setTimeout(resolve, 1000));}
    }
    return enrichedTweets;
}

async function getViewCountFromTwitter(screenName: string, tweetId: string): Promise<number | null> {
    let browser;
    try {
        browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=VizDisplayCompositor']});
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
        const urls = [
            `https://twitter.com/${encodeURIComponent(screenName)}/status/${tweetId}`,
            `https://x.com/${encodeURIComponent(screenName)}/status/${tweetId}`,
            `https://mobile.twitter.com/${encodeURIComponent(screenName)}/status/${tweetId}`
        ];
        for (const url of urls) {
            try {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
                await new Promise(resolve => setTimeout(resolve, 2000));
                const viewCount = await page.evaluate(() => {
                    const ariaElements = Array.from(document.querySelectorAll('[aria-label*="view"], [aria-label*="View"]'));
                    for (const element of ariaElements) {
                        const ariaLabel = element.getAttribute('aria-label') || '';
                        const viewMatch = ariaLabel.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?)\s*(?:view|View)/i);
                        if (viewMatch) {
                            const viewText = viewMatch[1];
                            let viewNum = parseFloat(viewText.replace(/,/g, ''));
                            if (viewText.includes('K')) viewNum *= 1000;
                            if (viewText.includes('M')) viewNum *= 1000000;
                            if (viewText.includes('B')) viewNum *= 1000000000;
                            return Math.floor(viewNum);
                        }
                    }
                    const allElements = Array.from(document.querySelectorAll('*'));
                    for (const element of allElements) {
                        const text = element.textContent || '';
                        if (text.match(/^\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?\s*(?:view|View)s?$/i)) {
                            const viewMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?[KMB]?)/);
                            if (viewMatch) {
                                const viewText = viewMatch[1];
                                let viewNum = parseFloat(viewText.replace(/,/g, ''));
                                if (text.includes('K')) viewNum *= 1000;
                                if (text.includes('M')) viewNum *= 1000000;
                                if (text.includes('B')) viewNum *= 1000000000;
                                return Math.floor(viewNum);
                            }
                        }
                    }
                    const dataElements = Array.from(document.querySelectorAll('[data-testid*="view"], [data-view], [data-views]'));
                    for (const element of dataElements) {
                        const dataValue = element.getAttribute('data-view') || element.getAttribute('data-views') || element.textContent;
                        if (dataValue) {const numMatch = dataValue.match(/(\d+)/); if (numMatch) return parseInt(numMatch[1]);}
                    }
                    return null;
                });
                if (viewCount !== null) {return viewCount;}
            }
            catch (error) {console.log(`Error with ${url}: ${error}`); continue;}
        }
        return null;
    } 
    catch (error) {console.error(`Puppeteer error for tweet ${tweetId}: ${error}`); return null;} 
    finally {if (browser) {await browser.close();}}
}

export async function scrapeNitterProfile(screenName: string = '', enableViewCounts = true): Promise<XProfileData> {
    let browser;
    let html: string | null = null;
    try {
        browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security', '--disable-features=VizDisplayCompositor', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']});
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const nitterInstances = ['https://nitter.net', 'https://nitter.fdn.fr', 'https://nitter.kavin.rocks', 'https://nitter.poast.org',];
        for (const instance of nitterInstances) {
            try {
                const url = `${instance}/${encodeURIComponent(screenName)}`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForSelector('.profile-card, .timeline-item', { timeout: 15000 });
                const pageTitle = await page.title();
                if (pageTitle.includes('Error') || pageTitle.includes('Not Found')) {console.log(`Error page received from ${instance}`); continue;}
                html = await page.content();
                break;
            } 
            catch (error) {console.log(`Failed to scrape ${instance}: ${error}`); continue;}
        }
        if (!html || html.length === 0) {throw new Error('Failed to scrape profile from all Nitter instances');}
    } 
    catch (error) {console.error('Puppeteer scraping failed:', error); throw error;} 
    finally {if (browser) {await browser.close();}}
    const stats = extractProfileStats(html);
    const profileInfo = extractProfileInfo(html);
    const tweets = extractTweetsFromHtml(html, screenName);
    const enrichedTweets = enableViewCounts ? await enrichWithViewCounts(tweets, screenName) : tweets;
    const profileData: XProfileData = {screenName,  ...profileInfo,  stats,  tweets: enrichedTweets};
    return profileData;
}

export async function scrapeTweets() {
  try {
    const profileData = await scrapeNitterProfile('', true);
    console.log(`Found ${profileData.tweets.length} tweets`);
    let newCount = 0;
    let updatedCount = 0;
    for (const tweet of profileData.tweets) {
      try {
        const tweetData = {
          id: tweet.id,
          tweet: tweet.tweet,
          created_at: tweet.created_at,
          metrics: tweet.metrics,
          permalink: tweet.permalink,
          quotedTweet: tweet.quotedTweet ? {id: tweet.quotedTweet.id, tweet: tweet.quotedTweet.tweet, created_at: tweet.quotedTweet.created_at, permalink: tweet.quotedTweet.permalink} : undefined,
          screenName: profileData.screenName,
          scrapedAt: new Date()
        };
        const existingTweet = await Tweet.findOne({ id: tweet.id });
        if (existingTweet) {
          await Tweet.findOneAndUpdate({ id: tweet.id }, { $set: {metrics: tweetData.metrics, quotedTweet: tweetData.quotedTweet, scrapedAt: tweetData.scrapedAt} });
          updatedCount++;
          console.log(`🔄 Updated tweet metrics: ${tweet.id}`);
        } 
        else {await Tweet.create(tweetData); newCount++;}
      } 
      catch (error) {console.error(`Error upserting tweet ${tweet.id}:`, error);}
    }
    console.log(`Tweet scraping complete: ${newCount} new, ${updatedCount} updated`);
  } 
  catch (error) {console.error('Error during tweet scraping:', error);}
}