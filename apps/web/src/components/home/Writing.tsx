"use client"
import { useRef, useState } from "react"
import { researchItems, newsletterItems, type ResearchSource } from "../../lib/research-data"

type Kind = ResearchSource | "Newsletter"

type WritingItem = {
  title: string
  url: string
  date: string
  excerpt?: string
  kind: Kind
  tags?: string[]
  coAuthors?: string[]
}

const kindColor: Record<Kind, string> = {
  Report: "text-green-500",
  Newsletter: "text-purple-400",
  "Dashboard Primer": "text-teal-400",
  Substack: "text-orange-500",
  Medium: "text-gray-300",
  Academic: "text-blue-400",
  X: "text-sky-400",
}

const PAGE_SIZE = 10

const items: WritingItem[] = [
  ...researchItems.map((r) => ({ title: r.title, url: r.url, date: r.date, excerpt: r.excerpt, kind: r.source, tags: r.tags })),
  ...newsletterItems.map((n) => ({
    title: n.title,
    url: n.url,
    date: n.date,
    excerpt: n.subtitle,
    kind: "Newsletter" as const,
    coAuthors: n.authors.filter((a) => a !== "Nick Carpinito"),
  })),
].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

// Filter chips, most common kind first.
const kindCounts = items.reduce<Partial<Record<Kind, number>>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), {})
const kinds = (Object.keys(kindCounts) as Kind[]).sort((a, b) => kindCounts[b]! - kindCounts[a]!)

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" })

export default function Writing() {
  const [filter, setFilter] = useState<Kind | "All">("All")
  const [page, setPage] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)

  const filtered = filter === "All" ? items : items.filter((i) => i.kind === filter)
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const selectFilter = (k: Kind | "All") => {
    setFilter(k)
    setPage(0)
  }
  const goTo = (p: number) => {
    setPage(p)
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const chip = (k: Kind | "All", count: number) => (
    <button
      key={k}
      onClick={() => selectFilter(k)}
      aria-pressed={filter === k}
      className={`text-xs uppercase tracking-wide border rounded px-2 py-1 transition-colors ${
        filter === k ? "border-gray-400 text-gray-100" : "border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300"
      }`}
    >
      {k} <span className="text-gray-600">{count}</span>
    </button>
  )

  return (
    <section ref={sectionRef} className="mb-20 border-t border-gray-800 pt-20 scroll-mt-4">
      <h2 className="text-2xl font-bold mb-2 text-center">Writing</h2>
      <p className="text-xs text-gray-500 text-center mb-6">Reports, newsletters and posts</p>
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {chip("All", items.length)}
        {kinds.map((k) => chip(k, kindCounts[k]!))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className={`uppercase tracking-wide ${kindColor[item.kind]}`}>{item.kind}</span>
              <span className="text-gray-500">{formatDate(item.date)}</span>
            </div>
            <h3 className="text-base font-bold mb-2 group-hover:text-gray-300 transition-colors">{item.title}</h3>
            {item.excerpt && <p className="text-sm text-gray-400 line-clamp-3">{item.excerpt}</p>}
            {item.tags && item.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[10px] uppercase tracking-wide text-gray-500 border border-gray-800 rounded px-2 py-0.5">{tag}</span>
                ))}
              </div>
            )}
            {item.coAuthors && item.coAuthors.length > 0 && (
              <p className="mt-3 text-[10px] uppercase tracking-wide text-gray-500">with {item.coAuthors.join(", ")}</p>
            )}
          </a>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 text-xs">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            className="border border-gray-800 rounded px-3 py-1 hover:border-gray-600 disabled:opacity-30 disabled:hover:border-gray-800"
          >
            ← Prev
          </button>
          <span className="text-gray-500">Page {page + 1} of {pageCount}</span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= pageCount - 1}
            className="border border-gray-800 rounded px-3 py-1 hover:border-gray-600 disabled:opacity-30 disabled:hover:border-gray-800"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  )
}
