import mongoose from 'mongoose';
import { MONGODB_URI } from '../env';
import { buildCriteriaKey, getRentalListings, syncCraigslistRentals, defaultCraigslistRentalCriteria } from '../services/rentals';

interface CliOptions {
  limit: number;
  json: boolean;
  storedOnly: boolean;
  help: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    limit: 10,
    json: false,
    storedOnly: false,
    help: false
  };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--stored-only') {
      options.storedOnly = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (Number.isFinite(parsed) && parsed > 0) {options.limit = Math.floor(parsed);}
    }
  }
  return options;
}

function printHelp(): void {
  console.log(`
Usage: npm run test:rentals -- [options]

Options:
  --limit=10         Max rows to print from stored listings
  --stored-only      Skip the Craigslist sync and only read MongoDB
  --json             Print JSON output
  --help, -h         Show this help
  `.trim());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (!MONGODB_URI) {throw new Error('MONGODB_URI not set');}

  await mongoose.connect(MONGODB_URI);
  try {
    const syncResult = options.storedOnly ? null : await syncCraigslistRentals(defaultCraigslistRentalCriteria);
    const listings = await getRentalListings({
      criteriaKey: buildCriteriaKey(defaultCraigslistRentalCriteria),
      status: 'active',
      limit: options.limit
    });

    const preview = listings.map((listing) => ({
      postedAt: listing.postedAt,
      listingId: listing.listingId,
      price: listing.priceText || listing.price,
      bedrooms: listing.bedrooms,
      squareFeet: listing.squareFeet,
      location: listing.locationText,
      title: listing.title,
      url: listing.url
    }));

    if (options.json) {
      console.log(JSON.stringify({
        criteria: defaultCraigslistRentalCriteria,
        syncResult: syncResult ? {
          criteriaKey: syncResult.criteriaKey,
          searchUrl: syncResult.searchUrl,
          fetched: syncResult.fetched,
          created: syncResult.created,
          active: syncResult.active
        } : null,
        preview
      }, null, 2));
      return;
    }

    console.log('Rentals Test Run');
    console.log(`Criteria: ${defaultCraigslistRentalCriteria.name}`);
    if (syncResult) {
      console.log(`Fetched listings: ${syncResult.fetched}`);
      console.log(`Matched listings: ${syncResult.matched}`);
      console.log(`Filtered out: ${syncResult.filteredOut}`);
      console.log(`New listings: ${syncResult.created}`);
      console.log(`Active listings: ${syncResult.active}`);
    }
    console.log(`Stored preview count: ${preview.length}`);
    if (preview.length > 0) {console.table(preview);}
    else {console.log('No rentals found for the configured criteria.');}
  }
  finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Rentals test script failed:', error);
  process.exit(1);
});
