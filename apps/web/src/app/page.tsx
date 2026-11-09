"use client"
import { Github, Linkedin, Twitter } from "lucide-react"
import Writing from "../components/home/Writing"

export default function CarpinitoLanding() {
  const experiences = [
    {
      title: "Research Analyst @ Blockworks",
      link: "https://www.blockworks.co/",
      period: "2025 - 2026",
      category: "Research, Data, Product",
      description: "Split time between research and building. Wrote reports and the weekly 0xResearch newsletter. Also wrote PRDs and shipped code for Blockworks products and internal tools.",
      achievements: [
        { text: "One of three on the Token Transparency Framework team, built the RapidFile Portal" },
        { text: "Rebuilt the Blockworks Intel fundraising data pipeline from scratch, replacing external vendors" }, 
        { text: "Ran internal analytics infrastructure and built AI agent workflows for research and content" }
      ]
    },
    {
      title: "Head of Research @ Mycelium Networks",
      link: "https://www.myceliumx.com/",
      period: "2021 - 2025",
      category: "DePIN, Compute, Research",
      description: "A distributed infrastructure incubator and accelerator with a built-in testbed. Started as an intern, then Research Analyst, then Head of Research.",
      achievements: [
        {
          text: "Grew the Mycelium Testbed from roughly 200 to 1,000+ deployed devices",
          url: "/docs/mycelium-testbed.pdf"
        },
        {
          text: "Bounds Accelerator Inaugural Cohort (2024)",
          url: "https://www.coinbase.com/blog/coinbase-ventures-to-support-university-of-arkansas-bounds-accelerator-to"
        }
      ]
    },
    {
      title: "Head of Research @ Parameter Research",
      link: "https://www.parameter.ventures/",
      period: "2023 - 2025",
      category: "Product, Research, Development",
      description: "DePIN data, analysis and due diligence.",
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
      description: "BSBA in Information Systems, concentration in Blockchain Enterprise Systems.",
      achievements: [
        {
          text: "2nd Place Razorblock Hackathon with CHRG",
        },
        {
          text: "Founder, UARK Crypto Club",
        },
        {
          text: "Independent study on running blockchain nodes on IBM z16 mainframes",
        }
      ]
    }
  ];

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
                  <span className="text-gray-400">(0xMetaLight)</span>
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
        <Writing />
      </main>
    </div>
  )
}
