import { queryNewsAPI } from './fetcher';
import { NewsModel, NewsTransformer } from './model';
import { scrapeLatestNews } from './scraper';
import { telegramService } from '../../utils/telegram';

export async function scrapeNews() {
  try {
    const scrapedNews = await scrapeLatestNews();
    const [newsApiResults] = await Promise.allSettled([queryNewsAPI('bitcoin OR ethereum OR cryptocurrency')]);
    let newsApiArticles: any[] = [];
    if (newsApiResults.status === 'fulfilled') {newsApiArticles = newsApiResults.value || [];} 
    else {console.error('NewsAPI fetch failed:', newsApiResults.reason);}
    const allNewsItems = [
      ...scrapedNews.filter(item => item.source?.toLowerCase().includes('velo') || !item.source || item.source === 'Velo').map(NewsTransformer.fromVeloNews),
      ...scrapedNews.filter(item => item.source && !item.source.toLowerCase().includes('velo')).map(NewsTransformer.fromTreeOfAlpha),
      ...newsApiArticles.map((article, index) => NewsTransformer.fromNewsAPI(article, index))
    ];
    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const newHighImpactNews: any[] = [];
    for (const newsItem of allNewsItems) {
      try {
        if (newsItem.url === '#') {newsItem.url = undefined;}
        let existing = null;
        if (newsItem.url) {existing = await NewsModel.findOne({ url: newsItem.url });}
        if (existing) {await NewsModel.findOneAndUpdate({ url: newsItem.url }, { $set: { votes: newsItem.votes, scrapedAt: new Date() }}); updatedCount++;} 
        else {
          await NewsModel.create(newsItem);
          newCount++;
          if (newsItem.impact === 'high') {newHighImpactNews.push(newsItem);}
        }
      } 
      catch (error) {errorCount++; console.error(`Error saving news item: ${newsItem.title?.substring(0, 50)}...`, error);}
    }
    console.log(`📈 News scraping complete: ${newCount} new, ${updatedCount} updated, 0 skipped, ${errorCount} errors`);
    if (newCount > 0 && newHighImpactNews.length > 0 && telegramService.isReady()) {
      try {await telegramService.sendHighImpactNews(newHighImpactNews);} 
      catch (error) {console.error('Error sending news to Telegram:', error);}
    }
  } 
  catch (error) {console.error('Error during news scraping:', error);}
}