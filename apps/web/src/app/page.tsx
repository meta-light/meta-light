"use client"
import { Github, Linkedin, Twitter } from "lucide-react"
import { researchItems, newsletterItems, type ResearchSource } from "../lib/research-data"

const sourceColor: Record<ResearchSource, string> = {
  Flashnote: "text-green-500",
  "Dashboard Primer": "text-teal-400",
  Substack: "text-orange-500",
  Medium: "text-gray-300",
  Academic: "text-blue-400",
  X: "text-sky-400",
}

export default function CarpinitoLanding() {
  const experiences = [
    {
      title: "Research Analyst @ Blockworks",
      link: "https://www.blockworks.co/",
      period: "2025 - Present",
      category: "Research, Data, DePIN",
      description: "Deep Research and Analysis for Blockworks Research subscribers.",
      achievements: []
    },
    {
      title: "Head of Research @ Mycelium Networks",
      link: "https://www.myceliumx.com/",
      period: "2021 - 2025",
      category: "DePIN, Compute, Research",
      description: "A DePIN Ecosystem Incubator, Accelerator, and Enterprise Miner.",
      achievements: [
        { 
          text: "Bounds Accelerator Inaugural Cohort",
          url: "https://www.coinbase.com/blog/coinbase-ventures-to-support-university-of-arkansas-bounds-accelerator-to"
        },
        {
          text: "Mycelium Testbed",
          url: "/docs/mycelium-testbed.pdf"
        }
      ]
    },
    {
      title: "Head of Research @ Parameter Research",
      link: "https://www.parameter.ventures/",
      period: "2023 - 2025",
      category: "DePIN, Growth, Dev",
      description: "DePIN Data, Analysis and Hot Takes",
      achievements: [
        { 
          text: "DePIN Pulse",
          url: "https://depinpulse.app/"
        },
        {
          text: "Unleashing DePIN",
          url: "https://www.unleashingdepin.com/"
        },
        {
          text: "Total Eclipse Challenge Community Award for Eclipse XRAY Hackathon",
          url: "https://eclipsexray.id/"
        }
      ]
    },
    {
      title: "Mentor @ Outlier Ventures DePIN Accelerator",
      link: "https://outlierventures.io/base-camp/depin-2025/",
      period: "2025",
      category: "DePIN",
      description: "",
      achievements: []
    },
    {
      title: "Mentor @ DePIN Surf Accelerator",
      link: "https://depin.surf/",
      period: "2024",
      category: "DePIN",
      description: "",
      achievements: []
    },
    {
      title: "Blockchain Enterprise Systems @ University of Arkansas",
      link: "https://uark.edu",
      period: "2019 - 2023",
      category: "Web3, Finance, Computer Science",
      description: "B.S.B.A Information Systems.",
      achievements: [
        {
          text: "2nd Place Razorblock Hackathon with CHRG",
        },
        {
          text: "UARK Crypto Club",
        }
      ]
    }
  ];

  const research = researchItems;
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" });

  return (
    <div className="min-h-screen bg-black text-gray-100 font-mono">
      <main className="max-w-6xl mx-auto px-6">
        <section className="py-4">
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
                Nick Carpinito
                <div className="flex items-center gap-2">
                  <img src="/home/dewi-cat.gif" alt="Dewi Cat" width={60} height={60} />
                  <span className="text-gray-400">(Meta-Light)</span>
                </div>
              </h1>
            </div>
          </div>
          <div className="max-w-2xl mx-auto text-center mb-8">
            <p className="text-lg mb-4 font-bold">Distributed infrastructure analyst covering economics, governance, and transparency.</p>
          </div>
          <div className="max-w-2xl mx-auto text-center mb-4">
            <div className="flex justify-center space-x-4">
            <a href="https://x.com/0xMetaLight" target="_blank" rel="noopener noreferrer">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://github.com/meta-light" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/in/nick-carpinito" target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://dune.com/metalight" target="_blank" rel="noopener noreferrer">
                <img src="/home/icons/dune.png" alt="Telegram" width={20} height={20} />
              </a>
              <a href="https://www.parameter.ventures/" target="_blank" rel="noopener noreferrer">
                <img src="/home/icons/substack.svg" alt="Substack" width={20} height={20} className="h-4 w-4 invert" />
              </a>
            </div>
          </div>
        </section>
        <section className="mb-20 border-t border-gray-800 pt-20">
          <h2 className="text-2xl font-bold mb-12 text-center">About</h2>
          <div className="relative">
            <div className="absolute left-0 h-full w-px bg-gray-800"></div>
            {experiences.map((experience, index) => (
              <div key={index} className="relative mb-6">
                <div className="flex items-start">
                  <div className="absolute left-0 w-3 h-3 bg-gray-400 rounded-full transform -translate-x-1.5 mt-2"></div>
                  <div className="pl-8">
                    <h3 className="text-xl font-bold">
                        {experience.link ? (
                            <a href={experience.link} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 hover:underline transition-colors">    
                                {experience.title}
                            </a>
                        ) : (<span>{experience.title}</span>)}
                    </h3>
                    <div className="text-xs text-gray-500 text-green-500">{experience.period} | {experience.category}</div>
                    <p className="text-sm text-gray-400 mb-3">{experience.description}</p>
                    {experience.achievements.length > 0 && (
                      <div className="text-xs text-gray-500">
                        {experience.achievements.map((achievement, i) => (
                          <div key={i} className="flex items-start">
                            <span className="mr-1">•</span>
                            {achievement.url ? (
                              <a
                                href={achievement.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-gray-300 hover:underline transition-colors"
                              >{achievement.text}</a>
                            ) : (
                              <span>{achievement.text}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mb-20 border-t border-gray-800 pt-20">
          <h2 className="text-2xl font-bold mb-2 text-center">Research</h2>
          <p className="text-xs text-gray-500 text-center mb-12">{research.length} pieces across Blockworks, Substack &amp; more</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {research.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2 text-xs">
                  <span className={`uppercase tracking-wide ${sourceColor[item.source]}`}>{item.source}</span>
                  <span className="text-gray-500">{formatDate(item.date)}</span>
                </div>
                <h3 className="text-base font-bold mb-2 group-hover:text-gray-300 transition-colors">{item.title}</h3>
                {item.excerpt && (<p className="text-sm text-gray-400 line-clamp-3">{item.excerpt}</p>)}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.slice(0, 3).map((tag) => (<span key={tag} className="text-[10px] uppercase tracking-wide text-gray-500 border border-gray-800 rounded px-2 py-0.5">{tag}</span>))}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
        <section className="mb-20 border-t border-gray-800 pt-20">
          <h2 className="text-2xl font-bold mb-2 text-center">Newsletters</h2>
          <p className="text-xs text-gray-500 text-center mb-12">{newsletterItems.length} editions co-authored at Blockworks Research</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {newsletterItems.map((n) => {
              const coAuthors = n.authors.filter((a) => a !== "Nick Carpinito")
              return (
                <a
                  key={n.url}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2 text-xs">
                    <span className="uppercase tracking-wide text-purple-400">Newsletter</span>
                    <span className="text-gray-500">{formatDate(n.date)}</span>
                  </div>
                  <h3 className="text-base font-bold mb-2 group-hover:text-gray-300 transition-colors">{n.title}</h3>
                  {n.subtitle && (<p className="text-sm text-gray-400 line-clamp-3">{n.subtitle}</p>)}
                  {coAuthors.length > 0 && (<p className="mt-3 text-[10px] uppercase tracking-wide text-gray-500">with {coAuthors.join(", ")}</p>)}
                </a>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
