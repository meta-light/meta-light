#!/usr/bin/env node
// Refresh the auto-pulled parts of src/lib/content.json.
//
//   Substack (public):        bun run apps/web/scripts/refresh-research.mjs
//   Blockworks (needs auth):  BWR_COOKIE="<cookie from a logged-in session>" bun run apps/web/scripts/refresh-research.mjs
//
// content.json is a single file keyed by source: { research, substack, twitter, newsletters }.
// This script only rewrites `substack` (always) and `research` (when BWR_COOKIE is set).
// It preserves manual curation:
//   - Substack posts that were moved into `newsletters` (matched by URL) are not re-added.
//   - BWR `twitterUrl` links (a piece also posted as an X article) are re-attached by slug.
// `twitter` and `newsletters` are never touched here — edit content.json directly for those.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "content.json");
const content = JSON.parse(readFileSync(FILE, "utf8"));

// --- Substack (public) ---
{
  let items = [];
  let url = "https://substack.com/api/v1/reader/feed/profile/263706204";
  for (let guard = 0; guard < 20 && url; guard++) {
    const j = await (await fetch(url)).json();
    items.push(...(j.items || []));
    url = j.nextCursor
      ? `https://substack.com/api/v1/reader/feed/profile/263706204?cursor=${encodeURIComponent(j.nextCursor)}`
      : null;
  }
  const movedUrls = new Set((content.newsletters || []).map((n) => n.url));
  const substack = items
    .filter((i) => i.post)
    .map((i) => ({
      title: i.post.title,
      url: i.post.canonical_url,
      date: i.post.post_date,
      excerpt: i.post.description || i.post.subtitle || "",
    }))
    .filter((s) => !movedUrls.has(s.url)); // keep items moved to newsletters out of substack
  content.substack = substack;
  console.log(`substack: ${substack.length} items`);
}

// --- Blockworks Research (auth-gated) ---
if (process.env.BWR_COOKIE) {
  const facets = "authors.slug:nick-carpinito,kind:article,kind:flashnote";
  const endpoint = (page) =>
    `https://app.blockworksresearch.com/api/algolia/research/search?limit=16&page=${page}&facetFilters=${encodeURIComponent(facets)}`;
  const twBySlug = new Map((content.research || []).filter((r) => r.twitterUrl).map((r) => [r.slug, r.twitterUrl]));
  const all = [];
  let page = 0;
  let nbPages = 1;
  do {
    const res = await fetch(endpoint(page), { headers: { cookie: process.env.BWR_COOKIE } });
    if (!res.ok) throw new Error(`BWR page ${page} -> ${res.status} (check BWR_COOKIE)`);
    const j = await res.json();
    all.push(...(j.hits || []));
    nbPages = j.nbPages ?? 1;
    page += 1;
  } while (page < nbPages);
  content.research = all.map((h) => {
    const item = {
      title: h.title,
      slug: h.slug,
      kind: h.kind,
      excerpt: h.excerpt || "",
      publishedAt: h.publishedAt || h.date,
      tags: (h.tags || []).map((t) => t.name).filter(Boolean),
    };
    if (twBySlug.has(h.slug)) item.twitterUrl = twBySlug.get(h.slug); // preserve X-article link
    return item;
  });
  console.log(`research: ${content.research.length} items across ${nbPages} page(s)`);
} else {
  console.log(`research: left as-is (${(content.research || []).length} items). Set BWR_COOKIE to refresh Blockworks.`);
}

writeFileSync(FILE, JSON.stringify(content, null, 2) + "\n");
console.log("content.json updated.");
