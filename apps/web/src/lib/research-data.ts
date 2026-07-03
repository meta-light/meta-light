import content from "./content.json";

export type ResearchSource = "Flashnote" | "Dashboard Primer" | "Substack" | "Medium" | "Academic" | "X";

export type ResearchItem = {
  title: string;
  url: string;
  date: string;
  excerpt?: string;
  source: ResearchSource;
  tags?: string[];
  officialUrl?: string;
};

type BwrRaw = {
  title: string;
  excerpt: string;
  tags: string[];
  slug?: string;
  kind?: string;
  publishedAt?: string;
  url?: string;
  date?: string;
  twitterUrl?: string;
  source?: ResearchSource;
};
type SubstackRaw = { title: string; url: string; date: string; excerpt: string };
type TwitterRaw = { title: string; url: string; date: string; excerpt: string };

export type NewsletterItem = {
  title: string;
  subtitle: string;
  url: string;
  date: string;
  authors: string[];
};

const bwrItems: ResearchItem[] = (content.research as BwrRaw[]).map((r) => {
  const officialUrl = r.slug
    ? `https://app.blockworksresearch.com/${r.kind === "flashnote" ? "flashnotes" : "research"}/${r.slug}`
    : (r.url ?? "");
  return {
    title: r.title,
    url: r.twitterUrl ?? officialUrl,
    officialUrl,
    date: r.publishedAt ?? r.date ?? "",
    excerpt: r.excerpt,
    source: r.source ?? "Flashnote",
    tags: r.tags,
  };
});

const substackItems: ResearchItem[] = (content.substack as SubstackRaw[]).map((s) => ({
  title: s.title,
  url: s.url,
  date: s.date,
  excerpt: s.excerpt,
  source: "Substack",
}));

const twitterItems: ResearchItem[] = (content.twitter as TwitterRaw[]).map((t) => ({
  title: t.title,
  url: t.url,
  date: t.date,
  excerpt: t.excerpt,
  source: "X",
}));

export const manualResearch: ResearchItem[] = [
  {
    title: "Zeta Markets: Onchain Metrics Leading Into the ZEX Airdrop",
    url: "https://medium.com/@nick_34554/zeta-markets-on-chain-metrics-leading-into-the-zex-airdrop-15022fd88502",
    date: "2025-01-23",
    source: "Medium",
    excerpt:
      "Analyzing Zeta Markets' onchain activity and growth heading into the ZEX airdrop.",
  },
  {
    title: "Mycelium Testbed",
    url: "/docs/mycelium-testbed.pdf",
    date: "2024-01-01", // TODO: set the real publication date
    source: "Academic",
    excerpt: "Academic research on the Mycelium DePIN testbed.",
  },
];

export const researchItems: ResearchItem[] = [
  ...bwrItems,
  ...substackItems,
  ...twitterItems,
  ...manualResearch,
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const newsletterItems: NewsletterItem[] = [
  ...(content.newsletters as NewsletterItem[]),
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
