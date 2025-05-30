"use client"
import Image from "next/image"
import { Github, Linkedin, Twitter } from "lucide-react"

export default function CarpinitoLanding() {
  const experiences = [
    {
      title: "Research Analyst @ Blockworks",
      link: "https://www.blockworksresearch.com/",
      period: "2025 - Present",
      category: "Research, Data, DePIN",
      description: "Deep Research and Analysis for Blockworks Research subscribers.",
      achievements: []
    },
    {
      title: "Vibes Officer @ Parameter Research",
      link: "https://www.parameter.ventures/",
      period: "2025 - Present",
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
          text: "Total Eclipse Challenge Community Award for Eclipse XRAY",
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
      title: "Head of Ecosystem @ Mycelium Networks",
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

  const images = [
    "https://shdw-drive.genesysgo.net/DojEG4vUWnUZdbSUiajdNagYBtyqkZQaduvR6ya5Mfuy/DeWiCat-20-01ceg.gif",
    "https://shdw-drive.genesysgo.net/DojEG4vUWnUZdbSUiajdNagYBtyqkZQaduvR6ya5Mfuy/DeWiCat-40-xaxwy.gif",
    "https://na-assets.pinit.io/Dk6Ug2wbS8WiRF18AaAqJHyx93dWx7q5bxPmm2WxKP8K/bdaecbad-b31e-42b2-b0ea-25f9b44219ff/2909",
    "https://kqdrcflo4udv6fuso2idqze4xriydwboumpysiklwvfjzroyrdna.arweave.net/VAcRFW7lB18WknaQOGScvFGB2C6jH4khS7VKnMXYiNo?ext=jpg",
    "https://hews4nahwvpxmtgf5buyphoo3do5omfzgta3c3dewpj3pye6hg5q.arweave.net/OS0uNAe1X3ZMxehph53O2N3XMLk0wbFsZLPTt-CeObs?ext=png",
    "https://p3o27r5siavoajgj5zjrg34tm2mozm4ya4ukomq2nti2q5rrnruq.arweave.net/ft2vx7JAKuAkye5TE2-TZpjss5gHKKcyGmzRqHYxbGk?ext=png",
    "https://jt3ivxt36qziq3gzklitnipiruptzezehw72b62kw53egkv7glha.arweave.net/TPaK3nv0Mohs2VLRNqHojR88kyQ9v6D7Srd2Qyq_Ms4/1707606148.3841.png",
    "https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png",
    "https://prod-tensor-creators-s3.s3.us-east-1.amazonaws.com/drop-metadata/b76b5eb6-8c82-4089-bfb5-8dd7f35bbcb7/images/4542.png",
    "https://pt2mx3s3wtvbx2ryeebg3efrmby3i3smf7svrwvkfy7wouj44deq.arweave.net/fPTL7lu06hvqOCECbZCxYHG0bkwv5Vjaqi4_Z1E84Mk?ext=png",
    "https://updg8.com/imgdata/5otux6WEGtGfq4rEevSYwfvLWehNBSqF2DsFDAxcUwKo",

  ]

  const techSkills = [
    "TypeScript", "JavaScript", "MongoDB", "Docker", "REST APIs", "Nvidia",
    "Svelte", "NextJS", "React", "Git", "Web3.js", "ExpressJS", "Vercel",
    "RPCs", "SQL", "C#", "Web Scraping", "LoRaWAN", "RF Environments",
    "IoT Sensors", "Linux", "Dune", "Flipside", "Server Hardware", "Bare Metal Servers"
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
                  <span className="text-gray-400">(Meta-Light)</span>
                </div>
              </h1>
            </div>
          </div>
          <div className="max-w-2xl mx-auto text-center mb-8">
            <p className="text-lg mb-4 font-bold">A Digital Asset Researcher focused on the DePIN, PoW, and Distributed Infrastructure.</p>
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
              <a href="https://flipside.com/@metalight" target="_blank" rel="noopener noreferrer">
                <img src="/home/icons/flipside.png" alt="Flipside" width={20} height={20} className="h-4 w-4 invert" />
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
                          <div key={i}>
                            {achievement.url ? (
                              <a 
                                href={achievement.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="hover:text-gray-300 hover:underline transition-colors"
                              >• {achievement.text}</a>
                            ) : (<div>• {achievement.text}</div>)}
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
          <h2 className="text-2xl font-bold mb-12 text-center">Tech I Like</h2>
          <div className="gap-20 text-center">
            <div className="border border-gray-800 p-6">
              <div className="text-xs text-gray-400 space-y-1">
                <div>{techSkills.join(" • ")}</div>
              </div>
            </div>
          </div>
        </section>
        <section className="mb-20 border-t border-gray-800 pt-20">
          <h2 className="text-2xl font-bold mb-12 text-center">Art</h2>
          <div className="flex flex-wrap justify-center">
            {images.map((image, index) => (
                <div key={index} className="relative h-64 md:h-80 w-full md:w-1/3 border-r border-gray-800 md:last:border-r-0 md:[&:nth-child(3n)]:border-r-0">
                    <Image
                        src={image}
                        alt={`Artwork ${index + 1}`}
                        fill
                        className="object-cover grayscale"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        priority={index < 3}
                        onError={(e) => {
                          console.error(`Failed to load image ${index + 1}:`, image);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
