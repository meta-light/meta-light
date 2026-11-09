import { speakingItems, type SpeakingPlatform } from "../../lib/research-data"

const platformColor: Record<SpeakingPlatform, string> = {
  YouTube: "text-red-400",
  X: "text-sky-400",
  Photos: "text-amber-400",
  Link: "text-gray-400",
}

const platformAction: Record<SpeakingPlatform, string> = {
  YouTube: "Watch",
  X: "View post",
  Photos: "View photos",
  Link: "Open",
}

export default function Speaking() {
  return (
    <section className="mb-20 border-t border-gray-800 pt-20">
      <h2 className="text-2xl font-bold mb-2 text-center">Speaking</h2>
      <p className="text-xs text-gray-500 text-center mb-12">{speakingItems.length} panels, streams &amp; talks</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {speakingItems.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className={`uppercase tracking-wide ${platformColor[s.platform]}`}>{s.platform}</span>
              <span className="text-gray-500 group-hover:text-gray-300 transition-colors">{platformAction[s.platform]} ↗</span>
            </div>
            <h3 className="text-base font-bold group-hover:text-gray-300 transition-colors">{s.title}</h3>
          </a>
        ))}
      </div>
    </section>
  )
}
