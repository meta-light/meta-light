import puppeteer from 'puppeteer';

interface VeloNewsItem { title: string; date: string; source?: string; coin?: string; priority?: string; link?: string;}
interface ScrapingResult {success: boolean; data: VeloNewsItem[]; totalItems: number; timestamp: string; error?: string;}

async function scrapeVeloNews(): Promise<ScrapingResult> {
  const result: ScrapingResult = {success: false, data: [], totalItems: 0, timestamp: new Date().toISOString()};
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://velo.xyz/news', {waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.news-item', { timeout: 15000 });
    const newsItems = await page.evaluate(() => {
      const items: any[] = [];
      const newsElements = document.querySelectorAll('.news-item');
      newsElements.forEach((element: any) => {
        const titleEl = element.querySelector('h3');
        const title = titleEl ? titleEl.textContent?.trim() || '' : '';
        const dateEl = element.querySelector('.time-posted');
        const date = dateEl ? dateEl.textContent?.trim() || '' : '';
        const sourceEl = element.querySelector('.source');
        const source = sourceEl ? sourceEl.textContent?.trim() || '' : '';
        const coin = element.getAttribute('data-coin') || '';
        const priority = element.getAttribute('data-priority') || '';
        const linkEl = element.querySelector('a');
        const link = linkEl ? linkEl.href : '';
        if (title) {items.push({title, date,source: source || undefined, coin: coin || undefined, priority: priority || undefined, link: link || undefined});}
      });
      return items;
    });
    result.data = newsItems;
    result.totalItems = newsItems.length;
    result.success = true;
    console.log(`Successfully scraped ${result.totalItems} news items`);
  } 
  catch (error) {result.error = error instanceof Error ? error.message : String(error); console.error('Scraping failed:', result.error);} 
  finally {if (browser) {await browser.close();}}
  return result;
}

async function scrapeTreeOfAlphaNews(): Promise<ScrapingResult> {
  const result: ScrapingResult = { success: false, data: [], totalItems: 0, timestamp: new Date().toISOString() };
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://news.treeofalpha.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.contentTitle a', { timeout: 20000 });
    const scrollContainerSelector = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('div,main,section')) as HTMLElement[];
      let best: HTMLElement | null = null;
      let bestScore = 0;
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const sh = el.scrollHeight;
        const ch = el.clientHeight;
        if ((overflowY === 'auto' || overflowY === 'scroll') && sh > ch + 50) {
          const containsItems = el.querySelector('[data-item-index]') || el.querySelector('.contentTitle a');
          if (containsItems) {
            const score = sh - ch;
            if (score > bestScore) { best = el; bestScore = score; }
          }
        }
      }
      if (best) {
        best.setAttribute('data-scroll-target', 'toa-news');
        return '[data-scroll-target="toa-news"]';
      }
      document.body.setAttribute('data-scroll-target', 'toa-body');
      return 'body';
    });
    const collected = new Map<string, any>();
    let stableRounds = 0;
    let lastCount = 0;
    for (let i = 0; i < 80 && stableRounds < 8; i++) {
      const batch = await page.evaluate(() => {
        const out: { title: string; date: string; source?: string; link?: string }[] = [];
        const anchors = Array.from(document.querySelectorAll('.contentTitle a')) as HTMLAnchorElement[];
        for (const linkEl of anchors) {
          const href = linkEl.href || '';
          let host = '';
          try { host = new URL(href, location.href).hostname.toLowerCase(); } catch {}
          if (!href || host.endsWith('x.com') || host.endsWith('twitter.com')) continue;
          const card = linkEl.closest('.box.padding-smallest.rowToColumn') as HTMLElement | null;
          if (!card) continue;
          const title = (linkEl.textContent || '').trim();
          const timeWrapper = card.querySelector('.originTime') as HTMLElement | null;
          const date = (timeWrapper?.textContent || '').trim();
          let source = '';
          const colonIndex = title.indexOf(':');
          if (colonIndex > 0) source = title.slice(0, colonIndex).trim();
          else source = host.replace(/^www\./, '');
          if (title) out.push({ title, date, source: source || undefined, link: href });
        }
        return out;
      });
      for (const item of batch) {if (!item.link) continue; collected.set(item.link, item);}
      if (collected.size > lastCount) {lastCount = collected.size; stableRounds = 0;} 
      else {stableRounds += 1;}
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement | null;
        if (el) {el.scrollTop = el.scrollTop + Math.floor(el.clientHeight * 0.9);} 
        else {window.scrollBy(0, Math.floor(window.innerHeight * 0.9));}
      }, scrollContainerSelector);
      await new Promise((r) => setTimeout(r, 500));
    }
    const newsItems = Array.from(collected.values());
    result.data = newsItems;
    result.totalItems = newsItems.length;
    result.success = true;
    console.log(`Successfully scraped ${result.totalItems} Tree of Alpha news items`);
  } 
  catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error('Tree of Alpha scraping failed:', result.error);
  } 
  finally {if (browser) {await browser.close();}}
  return result;
}

function parseDateString(dateString: string): number {
  if (!dateString) return 0;
  const cleaned = dateString.replace(/\s+/g, ' ').trim();
  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const rest = match[4] || '';
    const swapped = new Date(`${month}/${day}/${year}${rest}`);
    if (!Number.isNaN(swapped.getTime())) return swapped.getTime();
  }
  return 0;
}

export async function scrapeLatestNews(): Promise<VeloNewsItem[]> {
  const velo = await scrapeVeloNews();
  const toa = await scrapeTreeOfAlphaNews();
  const merged = [...(velo.data || []), ...(toa.data || [])];
  return merged.sort((a, b) => parseDateString(b.date) - parseDateString(a.date));
}

if (require.main === module) {scrapeLatestNews().then((items) => {console.log(`Scraped ${items.length} items`);}).catch(console.error);}

export type { VeloNewsItem, ScrapingResult };