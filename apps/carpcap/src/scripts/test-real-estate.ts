import { PropertyFilter, PropertyService } from '../services/real-estate';
import { defaultSearchCriteria } from '../services/real-estate/config';
import { Property, SearchCriteria } from '../services/real-estate/Property';

interface CliOptions {
  state?: string;
  city?: string;
  limit: number;
  onlyFsbo?: boolean;
  overvaluedThreshold?: number;
  json: boolean;
  help: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    limit: 100,
    json: false,
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
    if (arg.startsWith('--state=')) {
      options.state = arg.slice('--state='.length).toUpperCase();
      continue;
    }
    if (arg.startsWith('--city=')) {
      options.city = arg.slice('--city='.length).trim();
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (Number.isFinite(parsed) && parsed > 0) {options.limit = Math.floor(parsed);}
      continue;
    }
    if (arg.startsWith('--only-fsbo=')) {
      const value = arg.slice('--only-fsbo='.length).toLowerCase();
      if (value === 'true') {options.onlyFsbo = true;}
      if (value === 'false') {options.onlyFsbo = false;}
      continue;
    }
    if (arg.startsWith('--overvalued-threshold=')) {
      const parsed = Number(arg.slice('--overvalued-threshold='.length));
      if (Number.isFinite(parsed) && parsed >= 0) {options.overvaluedThreshold = parsed;}
      continue;
    }
  }
  return options;
}

function printHelp(): void {
  console.log(`
Usage: npm run test:real-estate -- [options]

Options:
  --state=CA                   Restrict data/filtering to a single state code
  --city="Los Angeles"         City hint passed to property fetch
  --limit=50                   Max properties fetched before filtering (default: 100)
  --only-fsbo=true|false       Override FSBO-only filter
  --overvalued-threshold=15    Override overvaluation threshold percent
  --json                       Print JSON output instead of table summary
  --help, -h                   Show this help

Examples:
  npm run test:real-estate
  npm run test:real-estate -- --state=TX --city=Austin --limit=75
  npm run test:real-estate -- --state=FL --only-fsbo=false --json
  `.trim());
}

function buildListingLink(property: Property): string {
  if (property.listingUrl) {return property.listingUrl;}
  const osmMatch = property.id.match(/^osm-(node|way|relation)-(\d+)$/);
  if (osmMatch) {
    const [, type, id] = osmMatch;
    return `https://www.openstreetmap.org/${type}/${id}`;
  }
  return `https://www.google.com/maps?q=${property.latitude},${property.longitude}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const criteria: SearchCriteria = {
    ...defaultSearchCriteria,
    states: options.state ? [options.state] : defaultSearchCriteria.states,
    onlyFSBO: options.onlyFsbo ?? defaultSearchCriteria.onlyFSBO,
    overvaluedThreshold: options.overvaluedThreshold ?? defaultSearchCriteria.overvaluedThreshold
  };

  const propertyService = new PropertyService();
  const stateHint = criteria.states[0];
  const properties = await propertyService.getProperties(stateHint, options.city, options.limit);
  const propertyFilter = new PropertyFilter(criteria);
  const filtered = propertyFilter.filterProperties(properties);

  const preview = filtered.slice(0, 10).map(property => {
    const metrics = propertyFilter.calculateMetrics(property);
    return {
      id: property.id,
      city: property.city,
      state: property.state,
      listingType: property.listingType,
      price: property.price,
      estimatedValue: property.estimatedValue,
      overvaluedByPct: metrics.percentAboveMarket,
      aboveMarketByUsd: metrics.dollarAboveMarket,
      listingLink: buildListingLink(property)
    };
  });

  if (options.json) {
    console.log(JSON.stringify({
      options,
      criteria,
      totals: {
        fetched: properties.length,
        matched: filtered.length
      },
      preview
    }, null, 2));
    return;
  }

  console.log('Real Estate Test Run');
  console.log(`Fetched properties: ${properties.length}`);
  console.log(`Matched properties: ${filtered.length}`);
  console.log(`State filter: ${criteria.states.join(', ')}`);
  console.log(`City hint: ${options.city || 'none'}`);
  console.log(`FSBO only: ${criteria.onlyFSBO}`);
  console.log(`Overvalued threshold: ${criteria.overvaluedThreshold}%`);

  if (preview.length > 0) {console.table(preview);}
  else {console.log('No properties matched the current filter criteria.');}
}

main().catch((error) => {
  console.error('Real-estate test script failed:', error);
  process.exit(1);
});
