"use client"

export default function Tech() {
  const techSkills = [
    "TypeScript", "JavaScript", "MongoDB", "Docker", "REST APIs", "Nvidia",
    "Svelte", "NextJS", "React", "Git", "Web3.js", "ExpressJS", "Vercel",
    "RPCs", "SQL", "C#", "Web Scraping", "LoRaWAN", "RF Environments",
    "IoT Sensors", "Linux", "Dune", "Flipside", "Server Hardware", "Bare Metal Servers"
  ];

  return (
    <div className="min-h-screen bg-black text-gray-100 font-mono">
      <main className="max-w-6xl mx-auto px-6">
        <section className="mb-20 border-t border-gray-800 pt-20">
          <h2 className="text-2xl font-bold mb-12 text-center">Tech I Like</h2>
          <div className="gap-20 text-center">
            <div className="border border-gray-800 p-6">
              <div className="text-xs text-gray-400 space-y-1">
                <div>{techSkills.join(" • ")}</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
