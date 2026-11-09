#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { slugify_url, utc_today } from "./index";

type TurndownInstance = {
  turndown(input: string): string;
};

type TurndownConstructor = new (options?: {
  headingStyle?: "setext" | "atx";
  hr?: string;
  bulletListMarker?: "-" | "*" | "+";
  codeBlockStyle?: "indented" | "fenced";
}) => TurndownInstance;

type XPostData = {
  author: string;
  handle: string;
  text: string;
  timestamp: string;
  metrics: Record<string, string>;
  quoted: string;
  replies: string[];
};

type BrowserViewport = { width: number; height: number };

type BrowserElement = {
  $(selector: string): Promise<BrowserElement | null>;
  $$(selector: string): Promise<BrowserElement[]>;
  evaluate<T, A extends unknown[]>(
    pageFunction: (element: unknown, ...args: A) => T,
    ...args: A
  ): Promise<T>;
};

type BrowserPage = {
  goto(
    url: string,
    options?: {
      waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
      timeout?: number;
    },
  ): Promise<unknown>;
  waitForSelector(
    selector: string,
    options?: { timeout?: number },
  ): Promise<unknown>;
  waitForNetworkIdle(options?: { timeout?: number }): Promise<unknown>;
  title(): Promise<string>;
  setUserAgent(userAgent: string): Promise<void>;
  setViewport(viewport: BrowserViewport): Promise<void>;
  $(selector: string): Promise<BrowserElement | null>;
  $$(selector: string): Promise<BrowserElement[]>;
};

type BrowserInstance = {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
};

type PuppeteerLike = {
  launch(options?: {
    headless?: boolean | "shell" | "new";
  }): Promise<BrowserInstance>;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function printTurndownInstallHelp(): void {
  console.error("Error: turndown not installed.");
  console.error("Run: bun add turndown");
}

function printPuppeteerInstallHelp(): void {
  console.error("Error: puppeteer not installed.");
  console.error("Run: bun add puppeteer");
}

async function loadTurndown(): Promise<TurndownConstructor> {
  const moduleName = "turndown";
  try {
    const imported = (await import(moduleName)) as {
      default?: TurndownConstructor;
    } & Partial<TurndownConstructor>;
    const Constructor =
      imported.default ?? (imported as unknown as TurndownConstructor);
    return Constructor;
  } catch {
    printTurndownInstallHelp();
    process.exit(1);
  }
}

async function loadPuppeteer(): Promise<PuppeteerLike> {
  const moduleName = "puppeteer";
  try {
    const imported = (await import(moduleName)) as {
      default?: PuppeteerLike;
    } & Partial<PuppeteerLike>;
    return imported.default ?? (imported as unknown as PuppeteerLike);
  } catch {
    printPuppeteerInstallHelp();
    process.exit(1);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripScriptsAndStyles(html: string): string {
  let output = html;
  output = output.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  output = output.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  return output;
}

function extractBodyHtml(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[0] ?? html;
}

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  let output = text.replace(
    /&(amp|lt|gt|quot|nbsp);|&#39;/g,
    (entity) => namedEntities[entity] ?? entity,
  );
  output = output.replace(/&#(\d+);/g, (_, codepoint) => {
    const parsed = Number.parseInt(codepoint, 10);
    if (!Number.isFinite(parsed)) return _;
    return String.fromCodePoint(parsed);
  });
  output = output.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const parsed = Number.parseInt(hex, 16);
    if (!Number.isFinite(parsed)) return _;
    return String.fromCodePoint(parsed);
  });
  return output;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function normalizeTextSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const title = normalizeTextSpaces(decodeHtmlEntities(stripTags(match[1])));
  return title || undefined;
}

function extractFirstH1(html: string): string | undefined {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return undefined;
  const heading = normalizeTextSpaces(decodeHtmlEntities(stripTags(match[1])));
  return heading || undefined;
}

function extractTitleFromMarkdown(markdown: string): {
  title?: string;
  body: string;
} {
  const match = markdown.match(/^\s*#\s+(.+?)\s*\n+/);
  if (!match) return { body: markdown };
  return {
    title: match[1].trim(),
    body: markdown.slice(match[0].length).replace(/^\s+/, ""),
  };
}

async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = await loadTurndown();
  const turndown = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  return turndown.turndown(html);
}

async function safeInnerText(element: BrowserElement | null): Promise<string> {
  if (!element) return "";
  try {
    return await element.evaluate((node) => {
      const target = node as {
        innerText?: string;
        textContent?: string | null;
      };
      const text = target.innerText ?? target.textContent ?? "";
      return text.trim();
    });
  } catch {
    return "";
  }
}

async function safeAttribute(
  element: BrowserElement | null,
  name: string,
): Promise<string> {
  if (!element) return "";
  try {
    const value = await element.evaluate((node, attr) => {
      const target = node as {
        getAttribute?: (attribute: string) => string | null;
      };
      if (typeof target.getAttribute !== "function") return null;
      return target.getAttribute(attr);
    }, name);
    return value ?? "";
  } catch {
    return "";
  }
}

export async function extractXPost(page: BrowserPage): Promise<XPostData> {
  try {
    await page.waitForSelector('article[data-testid="tweet"]', {
      timeout: 10_000,
    });
  } catch {
    // Keep going; content may still be present.
  }

  let tweetText = "";
  try {
    const tweetEl = await page.$('article[data-testid="tweet"]');
    const textEl = tweetEl
      ? await tweetEl.$('[data-testid="tweetText"]')
      : null;
    tweetText = await safeInnerText(textEl);
  } catch {
    // No-op
  }

  let author = "";
  let handle = "";
  try {
    const userEl = await page.$(
      'article[data-testid="tweet"] [data-testid="User-Name"]',
    );
    if (userEl) {
      const spans = await userEl.$$("span");
      const texts: string[] = [];
      for (const span of spans) {
        const text = await safeInnerText(span);
        if (text) texts.push(text);
      }
      if (texts.length > 0) author = texts[0];
      for (const text of texts) {
        if (text.startsWith("@")) {
          handle = text;
          break;
        }
      }
    }
  } catch {
    // No-op
  }

  let timestamp = "";
  try {
    const timeEl = await page.$('article[data-testid="tweet"] time');
    timestamp =
      (await safeAttribute(timeEl, "datetime")) ||
      (await safeInnerText(timeEl));
  } catch {
    // No-op
  }

  const metrics: Record<string, string> = {};
  try {
    for (const metricName of ["reply", "retweet", "like", "bookmark"]) {
      const el = await page.$(
        `article[data-testid="tweet"] [data-testid="${metricName}"]`,
      );
      const text = (await safeInnerText(el)).trim();
      if (text && text !== "0") metrics[metricName] = text;
    }
  } catch {
    // No-op
  }

  let quoted = "";
  try {
    const quoteEl = await page.$(
      'article[data-testid="tweet"] [data-testid="quoteTweet"]',
    );
    quoted = await safeInnerText(quoteEl);
  } catch {
    // No-op
  }

  const replies: string[] = [];
  try {
    const replyArticles = await page.$$('article[data-testid="tweet"]');
    for (const article of replyArticles.slice(1, 5)) {
      const textEl = await article.$('[data-testid="tweetText"]');
      const replyText = await safeInnerText(textEl);
      if (replyText && replyText !== tweetText) replies.push(replyText);
    }
  } catch {
    // No-op
  }

  return {
    author,
    handle,
    text: tweetText,
    timestamp,
    metrics,
    quoted,
    replies,
  };
}

export async function extractGeneric(page: BrowserPage): Promise<string> {
  try {
    await page.waitForNetworkIdle({ timeout: 15_000 });
  } catch {
    // Continue with whatever rendered.
  }

  const title = (await page.title()) || "";
  const selectors = [
    "article",
    "main",
    '[role="main"]',
    ".content",
    "#content",
    "body",
  ];
  let content = "";

  for (const selector of selectors) {
    const el = await page.$(selector);
    const text = await safeInnerText(el);
    if (text.length > content.length) content = text;
  }

  return `# ${title}\n\n${content}`;
}

export async function scrapeUrl(
  url: string,
  outputPath: string,
): Promise<void> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}): ${response.statusText}`,
    );
  }

  const sourceUrl = response.url || url;
  const html = await response.text();
  const bodyHtml = stripScriptsAndStyles(extractBodyHtml(html));

  let markdown = await htmlToMarkdown(bodyHtml);
  markdown = normalizeLineEndings(markdown).trim();

  const parsedFromMarkdown = extractTitleFromMarkdown(markdown);
  markdown = parsedFromMarkdown.body;

  const title =
    parsedFromMarkdown.title ??
    extractTitleTag(html) ??
    extractFirstH1(html) ??
    slugify_url(sourceUrl);

  const scrapedDate = utc_today();
  let output = `# ${title}\n\nSource: ${sourceUrl}\nScraped: ${scrapedDate}\n\n---\n\n${markdown}`;
  if (output && !output.endsWith("\n")) {
    output += "\n";
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
}

export async function scrapeWithBrowser(
  url: string,
  outputPath: string,
): Promise<void> {
  const isXPost = url.includes("x.com") || url.includes("twitter.com");
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await sleep(3000);

    const scrapedDate = utc_today();
    let output: string;

    if (isXPost) {
      const data = await extractXPost(page);
      const title = data.author
        ? `${data.author} ${data.handle}`.trim()
        : "X Post";

      const contentParts: string[] = [];
      if (data.text) contentParts.push(data.text);
      if (data.quoted) contentParts.push(`\n**Quoted:**\n${data.quoted}`);
      if (data.timestamp) contentParts.push(`\n**Posted:** ${data.timestamp}`);
      if (Object.keys(data.metrics).length > 0) {
        const metricsStr = Object.entries(data.metrics)
          .map(([key, value]) => `${key}: ${value}`)
          .join(" | ");
        contentParts.push(`**Engagement:** ${metricsStr}`);
      }
      if (data.replies.length > 0) {
        contentParts.push("\n**Replies:**");
        for (const reply of data.replies) {
          contentParts.push(`- ${reply.slice(0, 200)}...`);
        }
      }

      const content = contentParts.join("\n\n");
      output = `# ${title}\n\nSource: ${url}\nScraped: ${scrapedDate}\n\n---\n\n${content}\n`;
    } else {
      const content = await extractGeneric(page);
      output = `Source: ${url}\nScraped: ${scrapedDate}\n\n---\n\n${content}\n`;
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  } finally {
    await browser.close();
  }
}

export const scrape_url = scrapeUrl;

function parseCliArgs(args: string[]): {
  url?: string;
  output?: string;
  useBrowser: boolean;
  help: boolean;
} {
  let useBrowser = false;
  let help = false;
  const positional: string[] = [];

  for (const arg of args) {
    if (arg === "--browser") {
      useBrowser = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    positional.push(arg);
  }

  return {
    url: positional[0],
    output: positional[1],
    useBrowser,
    help,
  };
}

function printUsage(): void {
  console.log("Usage: bun packages/utils/src/scraper.ts <url> [output.md] [--browser]");
  console.log("");
  console.log("Examples:");
  console.log("  bun packages/utils/src/scraper.ts https://example.com");
  console.log("  bun packages/utils/src/scraper.ts https://x.com/user/status/123 --browser");
  console.log("  bun packages/utils/src/scraper.ts https://example.com out.md");
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const { url, output, useBrowser, help } = parseCliArgs(argv.slice(2));

  if (help) {
    printUsage();
    return;
  }
  if (!url) {
    printUsage();
    process.exit(1);
  }

  const outputPath = output ?? `${slugify_url(url)}.md`;

  if (useBrowser) {
    await scrapeWithBrowser(url, outputPath);
  } else {
    await scrapeUrl(url, outputPath);
  }

  console.log(`Done: ${outputPath}`);
}

const isCliEntry = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (isCliEntry) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
