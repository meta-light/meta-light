import { NextRequest, NextResponse } from 'next/server';
import { NEWS_API_ORG_KEY } from '../../env';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (!NEWS_API_ORG_KEY) {throw new Error('NEWS_API_ORG_KEY is not set');}
    const newsApiUrl = new URL('https://newsapi.org/v2/everything');
    newsApiUrl.searchParams.append('apiKey', NEWS_API_ORG_KEY);
    const allowedParams = ['q', 'language', 'sortBy', 'pageSize', 'sources', 'domains'];
    allowedParams.forEach(param => {const value = searchParams.get(param); if (value) {newsApiUrl.searchParams.append(param, value);}});
    if (!searchParams.get('q')) {
      newsApiUrl.searchParams.append('q', 'bitcoin OR ethereum OR cryptocurrency');
      newsApiUrl.searchParams.append('language', 'en');
      newsApiUrl.searchParams.append('sortBy', 'publishedAt');
      newsApiUrl.searchParams.append('pageSize', '20');
    }
    const response = await fetch(newsApiUrl.toString(), {headers: {'Accept': 'application/json', 'User-Agent': 'CARP-Terminal/1.0'}});
    if (!response.ok) {throw new Error(`NewsAPI error: ${response.status}`);}
    const data = await response.json();
    return NextResponse.json(data, {headers: {'Cache-Control': 'public, max-age=180',},});
  } 
  catch (error) {
    console.error('NewsAPI error:', error);
    return NextResponse.json({ error: 'Failed to fetch news data' }, { status: 500 });
  }
} 