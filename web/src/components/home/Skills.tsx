import React from 'react';
import SkillCategory from './SkillCategory';

const Skills = () => {
  const softwareDevelopmentSkills = [
    { src: "/home/icons/ts.png", alt: "Typescript", name: "Typescript" },
    { src: "/home/icons/js.png", alt: "Javascript", name: "Javascript" },
    { src: "/home/icons/mongo.png", alt: "MongoDB", name: "MongoDB" },
    { src: "/home/icons/docker.png", alt: "Docker", name: "Docker" },
    { src: "/home/icons/pc.png", alt: "REST APIs", name: "REST APIs" },
    { src: "/home/icons/nvidia.png", alt: "Nvidia", name: "Nvidia" },
    { src: "/home/icons/svelte.svg", alt: "Svelte", name: "Svelte" },
    { src: "/home/icons/railway.png", alt: "Railway", name: "Railway" },
    { src: "/home/icons/nextjs.svg", alt: "NextJS", name: "NextJS" },
    { src: "/home/icons/vercel.svg", alt: "Vercel", name: "Vercel" },
    { src: "/home/icons/node.png", alt: "ExpressJS", name: "ExpressJS" },
    { src: "/home/icons/react.png", alt: "React JS", name: "React" },
    { src: "/home/icons/github.png", alt: "Git", name: "Git" },
    { src: "/home/icons/web3.png", alt: "Web3.js", name: "Web3.js" }
  ];

  const analyticsResearchSkills = [
    { src: "/home/icons/dune.png", alt: "Dune", name: "Dune" },
    { src: "/home/icons/flipside.png", alt: "Flipside", name: "Flipside" },
    { src: "/home/icons/stonks.png", alt: "SQL", name: "SQL", width: 256, height: 256 },
    { src: "/home/icons/scrape.png", alt: "Web Scraping", name: "Web Scraping" },
    { src: "/home/icons/rpc.png", alt: "RPC Queries", name: "RPC Queries" },
    { src: "/home/icons/analysis.png", alt: "Quantitative Analysis", name: "Quantitative Analysis" },
    { src: "/home/icons/duedilligence.png", alt: "Due Diligence", name: "Docs & Reporting" }
  ];

  const infrastructureSkills = [
    { src: "/home/icons/lorawan.png", alt: "LoRaWAN", name: "LoRaWAN" },
    { src: "/home/icons/rf.png", alt: "RF Environments", name: "RF Environments" },
    { src: "/home/icons/sensors.png", alt: "IoT Sensors", name: "IoT Sensors" },
    { src: "/home/icons/linux.png", alt: "Linux", name: "Linux", width: 256, height: 256 },
    { src: "/home/icons/server.png", alt: "Server Hardware", name: "Bare Metal Servers" }
  ];

  return (
    <section className="skillsSection" id="skills">
      <div className="sectionHead"><span></span><h2>SKILLS</h2></div>
      <div className="skillsContainer sectionContainer">
        <SkillCategory title="Software Development" skills={softwareDevelopmentSkills} />
        <SkillCategory title="Analytics & Research" skills={analyticsResearchSkills} />
        <SkillCategory title="Infrastructure" skills={infrastructureSkills} />
      </div>
    </section>
  );
};

export default Skills; 