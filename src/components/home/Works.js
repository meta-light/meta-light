import React from 'react';
import WorkBox from './WorkBox';

const Works = () => {
  return (
    <section className="worksSection" id="works">
      <div className="sectionHead"><span></span><h2>PROJECTS and EXPERIENCE</h2></div>
      <div className="worksContainer sectionContainer">
        
        <WorkBox
          images={[{ src: "/home/bwr.png", alt: "Blockworks" }]}
          title="Research Analyst"
          company="Blockworks"
          companyUrl="https://blockworks.co/"
          techStack={["Research", "Data", "DePIN"]}
        >
          <ul>
            <li>Conducting deep research and analysis for consumption by <a href="https://www.blockworksresearch.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Blockworks Research</a> subscribers.</li>
            <li>Monitoring market trends, ecosystem developments and relevant governance proposals.</li>
            <li>Analyzing on-chain datasets to support analysis and back team theses.</li>
          </ul>
        </WorkBox>

        <WorkBox
          images={[
            { src: "/home/ud.png", alt: "Unleashing DePIN" },
            { src: "/home/pulse.png", alt: "Unleashing DePIN Pulse" }
          ]}
          title="Head of Research"
          company="Parameter Research"
          companyUrl="https://www.parameter.ventures/"
          techStack={["DePIN", "Growth", "Software Development"]}
        >
          <ul>
            <li>Curating a pipeline of DePIN industry projects and emerging founders for <a href="https://www.unleashingdepin.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Unleashing DePIN</a>, spotlighting key innovators and new ventures.</li>
            <li>Conducting due diligence on featured projects, ensuring reliable and valuable insights for investors and the broader audience.</li>
            <li>Building <a href="https://depinpulse.app/" className="liveLink" target="_blank" rel="noopener noreferrer">DePIN Pulse</a>, an aggregator showcasing earnings opportunities across DePIN protocols, including APYs, ROIs, staking, mining hardware, and compute resources.</li>
            <li>Providing direct oversight of business development, onboarding, and partnerships, driving growth and adoption across the DePIN ecosystem.</li>
            <li>Awarded the Total Eclipse Challenge Community Award for <a href="https://eclipsexray.id/" className="liveLink" target="_blank" rel="noopener noreferrer">Eclipse XRAY</a>, the first community-built explorer for the Eclipse ecosystem, enabling native block exploration powered by public RPCs.</li>
          </ul>
        </WorkBox>

        <WorkBox
          images={[
            { src: "/home/mycelium.png", alt: "Mycelium Networks" },
            { src: "/home/mycdoc.png", alt: "Mycelium Networks" }
          ]}
          title="Head of Ecosystem"
          company="Mycelium Networks"
          companyUrl="http://myceliumnetworks.com/"
          techStack={["DePIN", "Compute", "Research"]}
        >
          <ul>
            <li>Oversaw the launch of the <a href="http://myceliumnetworks.com/testbed/" target="_blank" rel="noopener noreferrer" className='h3Style'>Mycelium Testbed</a>, a 1600+ SqMi incubator and accelerator for decentralized physical infrastructure networks (DePINs), enabling large-scale deployments of hardware and solutions.</li>
            <li>Led ecosystem partnerships with industry leaders such as Helium and IoTeX, as well as emerging projects like XNET and Wayru.</li>
            <li>Conducted comprehensive due diligence and market analysis of decentralized infrastructure projects, supported partners throughout their journey, and developed a robust database to track DePIN projects.</li>
            <li>Developed an automated internal backend system to collect and process data from both on-chain and off-chain sources, streamlining research and analysis efforts.</li>
            <li>Built, deployed, and maintained a fleet of bare-metal servers for mining, validation, and running various decentralized protocols.</li>
            <li>Member inaugural cohort of the Bounds Accelerator, backed by Coinbase Ventures and Haun Ventures.</li>
          </ul>
        </WorkBox>

        <WorkBox
          title="Volunteering"
          techStack={["Web3", "Strategy", "Mentoring"]}
        >
          <ul>
            <h4><span className="techStack"><a href="https://outlierventures.io/base-camp/depin-2025/" target="_blank" rel="noopener noreferrer" className='h3Style'>Outlier Ventures DePIN Accelerator</a> — Mentor</span></h4>
            <li>Provided strategic guidance to early stage DePIN builders to support growth and GTM strategy in early stage projects.</li>
            <li>Facilitated 12 weeks of dedicated support for the next generation of DePINs.</li>
          </ul>
          <br/>
          <ul>
            <h4><span className="techStack"><a href="https://depin.surf/" target="_blank" rel="noopener noreferrer" className='h3Style'>IoTeX DePIN Surf Accelerator</a> — Mentor</span></h4>
            <li>Developed informational content surrounding the design and development of DePIN Hardware for reference by cohort companies.</li>
            <li>Contributed to "Decentralized Physical Infrastructure Networks: A Modular Infrastructure Thesis" report alongside the DePIN community and IoTeX team.</li>
          </ul>
        </WorkBox>

        <WorkBox
          images={[{ src: "/home/cc.png", alt: "UARK" }]}
          title="Blockchain @ University of Arkansas"
          techStack={["Web3", "Finance", "Computer Science"]}
        >
          <ul>
            <li>B.S.B.A in Information Systems, Concentration in Blockchain Enterprise Systems</li>
            <li>Independent Study surrounding operation of blockchain nodes on IBM z16 Mainframe architecture</li>
            <li>Founded the <a href="https://hogsync.uark.edu/club_signup?group_type=&search=crypto&category_tags=&order=name_asc" target="_blank" rel="noopener noreferrer">UARK Crypto Club</a> - First student-led blockchain society in state of Arkansas</li>
            <li>Won 2nd Place in the Razorblock Blockchain Hackathon with CHRG, a decentralized protocol for electric vehicle (EV) charging infrastructure.</li>
            <li>Contributed to OzDAO - a local Web3 collective.</li>
          </ul>
        </WorkBox>

      </div>
    </section>
  );
};

export default Works; 