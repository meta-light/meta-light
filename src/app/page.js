"use client"
import React, { useEffect } from 'react';
import Head from 'next/head';
import './styles/styles.css';
import './styles/scss/styles.scss';
import './styles/LineIcons.css';
import Image from 'next/image';
import Sidebar from '../components/home/sidebar';

const Home = () => {
  useEffect(() => {
    const loadJQuery = async () => {
      const jQueryModule = await import('jquery');
      window.$ = window.jQuery = jQueryModule.default;
      const index = {};
      index.$menu = $('#sideMenu');
      index.$navItem = $('.navItem');
      index.$navItemName = $('.navItemName');
      index.$home = $('#home');
      index.$about = $('#about');
      index.$skills = $('#skills');
      index.$works = $('#works');
      index.$contact = $('#contact');
      index.$menuButton = $('#menuButton');
      index.$scrollDown = $('#scrollDown');
      index.isOpen = false;
      index.scroll = function(target) {$('html,body').animate({ scrollTop: $(target).offset().top }, 500);};
      index.showHideMenu = function() {index.$menu.toggleClass('sideMenuHide sideMenuShow'); index.isOpen = !index.isOpen;};
      if ($(window).width() <= 990) {index.$menu.addClass('sideMenuHide').removeClass('sideMenuShow'); index.$scrollDown.hide();}
      index.eventListeners = function() {
        $(window).on('resize', function() {
          if ($(window).width() > 990) {index.$menu.removeClass('sideMenuHide').addClass('sideMenuShow'); index.$scrollDown.show(); index.isOpen = false;} 
          else {index.$menu.removeClass('sideMenuShow').addClass('sideMenuHide'); index.isOpen = false; index.$scrollDown.hide();}
        });
        $('a[href*=\\#]').on('click', function() {index.scroll(this.hash);});
        index.$menuButton.on('click', index.showHideMenu);
        index.$navItem.on('click', function() {if (index.isOpen) {index.showHideMenu();}});
        index.$menuButton.on('keypress', function(e) {if (e.which === 13) {$(this).trigger('click');}});
      };
      index.init = function() {index.eventListeners();};
      $(function() {index.init();});
    };
    loadJQuery();
  }, []);

  const customLoader = ({ src, width, quality }) => {return `${src}?w=${width}&q=${quality || 75}`;};

  return (
    <>
      <Head><title>Nick Carpinito</title><meta name="description" content="GM"/></Head>
      <body>
        <div id="home" className="visuallyHidden"></div>
        <div className="menuButton" id="menuButton" tabIndex="0"><div className="linesContainer"></div></div>
        <Sidebar/>
        <div className="outerWrapper"> 
          <div className="innerWrapper">
            <header>
              <div className="heroImageContainer"><Image src="/home/dewi-cat.gif" alt="Dewi Cat" width={500} height={500} unoptimized/></div>
              <div className="heroDescription">
                <p className="greeting">GM</p>
                <h1><span>Nick Carpinito</span></h1>
                <p className="greeting">(Meta-Light)</p><br/>
                <p className="smallBio">A driven <span>Web3 Researcher</span> and <span>Ecosystem Developer</span> Driving the Future of Decentralized Networks</p>
                <div className="socialsResume">
                  <ul className="socialsList">
                    <li><a href="https://www.linkedin.com/in/nick-carpinito" target="_blank" rel="noopener noreferrer"><i className="lni lni-linkedin-original" aria-label="Link to my LinkedIn page."></i></a></li>
                    <li><a href="https://github.com/meta-light" target="_blank" rel="noopener noreferrer"><i className="lni lni-github-original" aria-label="Link to my GitHub page."></i></a></li>
                    <li><a href="https://twitter.com/0xMetaLight" target="_blank" rel="noopener noreferrer"><i className="lni lni-twitter-original" aria-label="Link to my Twitter profile."></i></a></li>
                    <li><a href="https://medium.com/@meta-light" target="_blank" rel="noopener noreferrer"><i className="lni lni-medium" aria-label="Link to my Medium Blog."></i></a></li>
                    <li><a href="https://dune.com/metalight/" target="_blank" rel="noopener noreferrer"><img src="/home/dune-logo.png" aria-label="Dune Dashboards" width={20} height={20}/></a></li>
                    <li><a href="https://flipsidecrypto.xyz/MetaLight/" target="_blank" rel="noopener noreferrer"><img src="/home/flipside.png" alt="Flipside Dashboards" width={20} height={20}/></a></li>
                  </ul>
                </div>
              </div>
            </header>
            <main>
              <section className="aboutSection" id="about">
                <div className="sectionHead"><span></span><h2>ABOUT ME</h2></div>
                <article className="aboutContainer sectionContainer">
                  <p>
                  I am a Web3 Ecosystem & Research leader focused on driving innovation in decentralized networks and high-performance infrastructure.
                  </p>
                  <br></br>
                  <p>
                  Over the past four years, I have been at the cutting edge of Web3, exploring the transformative potential of DePIN and Web3 Infrastructure sectors as they disrupt traditional industries. 
                  </p>
                  <br></br>
                  <p>
                  My work spans across various domains, with a commitment to advancing the technology’s potential to foster greater openness, transparency, and digital freedom.
                  </p>
                </article>
              </section>
              <section className="worksSection" id="works">
                <div className="sectionHead"><span></span><h2>PROJECTS and EXPERIENCE</h2></div>
                <div className="worksContainer sectionContainer">
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image src="/home/mycelium.png" alt="Mycelium Networks" width={500} height={500} unoptimized/><br></br>
                      <Image src="/home/mycdoc.png" alt="Mycelium Networks" width={500} height={500} unoptimized/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Head of Ecosystem @ <a href="http://myceliumnetworks.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Mycelium Networks</a></h3><h4><span className="techStack">DePIN</span>, <span className="techStack">Compute</span>, <span className="techStack">Research</span></h4>
                      <ul>
                        <li>Oversaw the launch of the <a href="http://myceliumnetworks.com/testbed/" target="_blank" rel="noopener noreferrer" className='h3Style'>Mycelium Testbed</a>, a 1600+ SqMi incubator and accelerator for decentralized physical infrastructure networks (DePINs), enabling large-scale deployments of hardware and solutions.</li>
                        <li>Led ecosystem partnerships with industry leaders such as Helium and IoTeX, as well as emerging projects like XNET and Wayru.</li>
                        <li>Conducted comprehensive due diligence and market analysis of decentralized infrastructure projects, supported partners throughout their journey, and developed a robust database to track DePIN projects.</li>
                        <li>Developed an automated internal backend system to collect and process data from both on-chain and off-chain sources, streamlining research and analysis efforts.</li>
                        <li>Built, deployed, and maintained a fleet of bare-metal servers for mining, validation, and running various decentralized protocols.</li>
                        <li>Member inaugural cohort of the Bounds Accelerator, backed by Coinbase Ventures and Haun Ventures.</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image src="/home/ud.png" alt="Unleashing DePIN" width={500} height={500} unoptimized/><br/>
                      <Image src="/home/pulse.png" alt="Unleashing DePIN Pulse" width={500} height={500} unoptimized/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Head of Research @ <a href="http://unleashingdepin.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Unleashing DePIN</a></h3><h4><span className="techStack">DePIN</span>, <span className="techStack">Growth</span>, <span className="techStack">Software Development</span></h4>
                      <ul>
                        <li>Curated a pipeline of DePIN industry projects and emerging founders for Unleashing DePIN, spotlighting key innovators and new ventures.</li>
                        <li>Conducted due diligence on featured projects, ensuring reliable and valuable insights for investors and the broader audience.</li>
                        <li>Built <a href="https://depinpulse.app/" className="liveLink" target="_blank" rel="noopener noreferrer">DePIN Pulse</a>, an aggregator showcasing earnings opportunities across DePIN protocols, including APYs, ROIs, staking, mining hardware, and compute resources.</li>
                        <li>Provided direct oversight of business development, onboarding, and partnerships, driving growth and adoption across the DePIN ecosystem.</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer"><Image src="/home/cc.png" alt="UARK" width={500} height={500} unoptimized/></div>
                    <div className="workDescribeContainer">
                      <h3>Blockchain @ University of Arkansas</h3><h4><span className="techStack">Web3</span>, <span className="techStack">Finance</span>, <span className="techStack">Computer Science</span></h4>
                      <ul>
                        <li>B.S.B.A in Information Systems, Concentration in Blockchain Enterprise Systems</li>
                        <li>Founded the <a href="https://hogsync.uark.edu/club_signup?group_type=&search=crypto&category_tags=&order=name_asc" target="_blank" rel="noopener noreferrer">UARK Crypto Club</a> - First student-led blockchain society in state of Arkansas</li>
                        <li>Contributed to OzDAO - a local Web3 collective.</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image src="/home/xray.png" alt="Mycelium Testbed" width={500} height={500} unoptimized/><br/><br/>
                      <Image src="/home/coldfront.png" alt="Mycelium Testbed" width={500} height={500} unoptimized/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Research & Experiments</h3>
                      <h4><span className="techStack">Web3</span>, <span className="techStack">DePIN</span>, <span className="techStack">Incentive Mechanisms</span></h4>
                      <ul>
                        <h4><span className="techStack">2024</span></h4>
                        <li>Awarded the Total Eclipse Challenge Community Award for <a href="https://eclipsexray.id/" className="liveLink" target="_blank" rel="noopener noreferrer">Eclipse XRAY</a>, the first community-built explorer for the Eclipse ecosystem, enabling native block exploration powered by public RPCs.</li>
                        <li>Explored compressed NFTs on Solana with <a href="/basket" className="liveLink" target="_blank" rel="noopener noreferrer">CNFT Basket</a>, a tool for creating tradable "baskets" of compressed NFTs.</li>
                        <h4><span className="techStack">2023</span></h4>
                        <li>Won 2nd Place in the <a href="https://www.youtube.com/playlist?list=PLjrNbvbJ6nUErr0nIMOsgIRKbqTDsvwZ5" className="liveLink" target="_blank" rel="noopener noreferrer">RazorBlock Hackathon</a> with <a href="/docs/chrg.pdf" className="liveLink" target="_blank" rel="noopener noreferrer">CHRG</a>, a decentralized protocol for electric vehicle (EV) charging infrastructure.</li>
                        <li>Developed Web3 dashboards using <a href="https://dune.com/metalight/" className="liveLink" target="_blank" rel="noopener noreferrer">Dune</a> and <a href="https://flipsidecrypto.xyz/MetaLight" className="liveLink" target="_blank" rel="noopener noreferrer">Flipside</a>, compiling some of the first user growth metrics in DePIN.</li>
                        <li>Built <a href="/movies" className="liveLink" target="_blank" rel="noopener noreferrer">MetaMovies</a>, a personal movie database leveraging OMDB, built with NextJS.</li>
                        <h4><span className="techStack">2022</span></h4>
                        <li>Developed <a href="/card" className="liveLink" target="_blank" rel="noopener noreferrer">SolCV</a>, a Solana based framework for minting business cards as compressed NFTs.</li>
                        <li>Acted as a Use Case Sponsor for the <a href="https://www.youtube.com/playlist?list=PLjrNbvbJ6nUErr0nIMOsgIRKbqTDsvwZ5" className="liveLink" target="_blank" rel="noopener noreferrer"> RazorBlock Hackathon </a>developing a Helium Network <a href="/docs/helium-blue-light.pdf" className="liveLink" target="_blank" rel="noopener noreferrer">Blue Light</a> System.</li>
                        <li>Conducted research on low-power cluster computing (<a href="https://twitter.com/0xMetaLight/status/1630989599488049154?s=20" className="liveLink" target="_blank" rel="noopener noreferrer">MultiNode</a>) in blockchain node operations.</li>
                        <li>Created <a href="https://coldfront.vercel.app/" className="liveLink" target="_blank" rel="noopener noreferrer">Coldfront</a>, a weather app offering current conditions, relevant news, and predictive analysis for Razorbacks Baseball games.</li>
                      </ul>
                    </div>
                  </article>
                </div>
              </section>
              <section className="skillsSection" id="skills">
                <div className="sectionHead"><span></span><h2>SKILLS</h2></div>
                <div className="skillsContainer sectionContainer">
                  <h1>Software Development</h1>
                  <ul className="skillsGrid">
                    <li><div className="itemContainer"><Image src="/home/icons/ts.png" alt="Typescript" width={35} height={35} unoptimized/><p>Typescript</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/js.png" alt="Javascript" width={35} height={35} unoptimized/><p>Javascript</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/mongo.png" alt="MongoDB" width={35} height={35} unoptimized/><p>MongoDB</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/docker.png" alt="" width={35} height={35} unoptimized/><p>Docker</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/pc.png" alt="" width={35} height={35} unoptimized/><p>REST APIs</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/nvidia.png" alt="Nvidia" width={35} height={35} unoptimized/><p>Nvidia</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/svelte.svg" alt="Svelte" width={35} height={35} unoptimized/><p>Svelte</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/railway.png" alt="Railway" width={35} height={35} unoptimized/><p>Railway</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/nextjs.svg" alt="NextJS" width={35} height={35} unoptimized/><p>NextJS</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/vercel.svg" alt="Vercel" width={35} height={35} unoptimized/><p>Vercel</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/node.png" alt="ExpressJS" width={35} height={35} unoptimized/><p>ExpressJS</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/react.png" alt="React JS" width={35} height={35} unoptimized/><p>React</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/github.png" alt="Git" width={35} height={35} unoptimized/><p>Git</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/web3.png" alt="Web3.js" width={35} height={35} unoptimized/><p>Web3.js</p></div></li>
                  </ul>
                  <h1>Analytics & Research</h1>
                  <ul className="skillsGrid">
                    <li><div className="itemContainer"><Image src="/home/icons/dune.png" alt="Dune" width={35} height={35} unoptimized/><p>Dune</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/flipside.png" alt="Flipside" width={35} height={35} unoptimized/><p>Flipside</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/stonks.png" alt="SQL" width={256} height={256} unoptimized/><p>SQL</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/scrape.png" alt="Web Scraping" width={35} height={35} unoptimized/><p>Web Scraping</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/rpc.png" alt="RPC Queries" width={35} height={35} unoptimized/><p>RPC Queries</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/analysis.png" alt="Quantitative Analysis" width={35} height={35} unoptimized/><p>Quantitative Analysis</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/duedilligence.png" alt="Due Diligence" width={35} height={35} unoptimized/><p>Docs & Reporting</p></div></li>
                  </ul>
                  <h1>Infrastructure</h1>
                  <ul className="skillsGrid">
                    <li><div className="itemContainer"><Image src="/home/icons/lorawan.png" alt="LoRaWAN" width={35} height={35} unoptimized/><p>LoRaWAN</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/rf.png" alt="RF Environments" width={35} height={35} unoptimized/><p>RF Environments</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/sensors.png" alt="IoT Sensors" width={35} height={35} unoptimized/><p>IoT Sensors</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/linux.png" alt="Linux" width={256} height={256} unoptimized/><p>Linux</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/server.png" alt="Server Hardware" width={35} height={35} unoptimized/><p>Bare Metal Servers</p></div></li>
                  </ul>
                </div>
              </section>
              <section className="contactSection" id="contact">
                <div className="sectionHead"><span></span><h2>CONTACT</h2></div>
                <div className="contactContainer sectionContainer">
                  <div className="contactTypes">
                    <div className="flexContainer"><div className="typeBox"><i className="lni lni-envelope"></i><a href="mailto:nick@carpinito.id">nick@carpinito.id</a><p>Email Me</p></div></div>
                    <div className="flexContainer"><div className="typeBox"><i className="lni lni-calendar"></i><a href="https://carp.youcanbook.me/" target="_blank" rel="noopener noreferrer">Calendar</a><p>Schedule a Meeting</p></div></div>
                  </div>
                </div> 
              </section>
            </main>
          </div>
        </div>
        <script src="https://code.jquery.com/jquery-3.5.1.js" integrity="sha256-QWo7LDvxbWT2tbbQ97B53yJnYU3WhH/C8ycbRAkjPDc=" crossOrigin="anonymous"></script>
      </body>
    </>
  );
}

export default Home;
