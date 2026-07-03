import { telegramBot } from '../../utils/telegram';
import { TELEGRAM_BOT_TOKEN } from '../../env';
import { IRentalListing } from './model';

const MAX_LISTINGS_PER_MESSAGE = 5;

export async function sendRentalListingNotifications(listings: IRentalListing[], criteriaName: string): Promise<string[]> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[rentals] Telegram not configured, skipping rental notifications');
    return [];
  }
  const notifiedIds: string[] = [];
  const chunks = chunkListings(listings, MAX_LISTINGS_PER_MESSAGE);
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const message = formatRentalListingsMessage(chunk, {
      criteriaName,
      totalListings: listings.length,
      chunkIndex: index,
      chunkCount: chunks.length
    });
    const sent = await telegramBot.sendMessage({
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      disable_notification: false
    });
    if (!sent) {continue;}
    notifiedIds.push(...chunk.map((listing) => listing.id));
  }
  return notifiedIds;
}

function formatRentalListingsMessage(
  listings: IRentalListing[],
  options: { criteriaName: string; totalListings: number; chunkIndex: number; chunkCount: number }
): string {
  const heading = options.chunkCount > 1
    ? `<b>New rental listings (${options.chunkIndex + 1}/${options.chunkCount})</b>`
    : '<b>New rental listings</b>';
  const subheading = `<i>${escapeHtml(options.criteriaName)}</i> • ${options.totalListings} new`;
  const body = listings.map((listing, index) => formatRentalListing(listing, options.chunkIndex * MAX_LISTINGS_PER_MESSAGE + index + 1)).join('\n\n');
  return [heading, subheading, '', body].join('\n');
}

function formatRentalListing(listing: IRentalListing, position: number): string {
  const facts = [
    listing.priceText || formatPrice(listing.price),
    listing.bedrooms ? `${listing.bedrooms}bd` : undefined,
    listing.squareFeet ? `${listing.squareFeet} sqft` : undefined
  ].filter(Boolean).join(' • ');
  const lines = [
    `${position}. <b>${escapeHtml(listing.title)}</b>`,
    facts ? `   ${escapeHtml(facts)}` : undefined,
    listing.locationText ? `   ${escapeHtml(listing.locationText)}` : undefined,
    `   <a href="${listing.url}">Open listing</a>`
  ].filter(Boolean);
  return lines.join('\n');
}

function formatPrice(price: number | undefined): string | undefined {
  if (price == null) {return undefined;}
  return `$${price.toLocaleString('en-US')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function chunkListings<T>(listings: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < listings.length; index += chunkSize) {
    result.push(listings.slice(index, index + chunkSize));
  }
  return result;
}
