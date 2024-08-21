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

  const customLoader = ({ src }) => {return `${src}`;};

  return (
    <>
      <Head><title>Nick Carpinito</title><meta name="description" content="A Web3 Researcher and BD Lead."/></Head>{/* Forked and heavily edited from https://github.com/alexcalia/alexCaliaPortfolio */}
      <body>
        <div id="home" className="visuallyHidden"></div>
        <div className="menuButton" id="menuButton" tabIndex="0"><div className="linesContainer"></div></div>
        <Sidebar />
        <div className="outerWrapper"> 
          <div className="innerWrapper">
            <header>
              <div className="heroImageContainer">
                <Image loader={customLoader} src="/home/dewi-cat.gif" alt="Dewi Cat" width={500} height={500} />
              </div>
              <div className="heroDescription">
                <p className="greeting">Howdy! I'm</p>
                <h1><span>Nick Carpinito</span></h1>
                <p className="greeting">(Meta-Light)</p>
                <br/>
                <p className="smallBio">A <span>Web3 Research</span> and <span>Ecosystem Lead</span> passionate about advancing the future of decentralized networks</p>
                <div className="socialsResume">
                  <a className="resumeLink" href="https://medium.com/@meta-light" alt="My Blog Here" target="_blank" rel="noopener noreferrer">Blog</a>
                  <ul className="socialsList">
                    <li><a href="https://www.linkedin.com/in/nick-carpinito" target="_blank" rel="noopener noreferrer"><i className="lni lni-linkedin-original" aria-label="Link to my LinkedIn page."></i></a></li>
                    <li><a href="https://github.com/meta-light" target="_blank" rel="noopener noreferrer"><i className="lni lni-github-original" aria-label="Link to my GitHub page."></i></a></li>
                    <li><a href="https://twitter.com/0xMetaLight" target="_blank" rel="noopener noreferrer"><i className="lni lni-twitter-original" aria-label="Link to my Twitter profile."></i></a></li>
                  </ul>
                </div>
              </div>
            </header>
            <main>
              <section className="aboutSection" id="about">
                <div className="sectionHead">
                  <span>SOME INFO</span>
                  <h2>ABOUT ME</h2>
                </div>
                <article className="aboutContainer sectionContainer">
                  <p>I’m Nick, a Web3 Research and Ecosystem Lead focused on <span>DePIN & Decentralized Compute</span>. I’ve spent the past 4 years working in Web3 tracking the emergence of the DePIN/DeVIN sectors and thier affects in legacy industries whom are ripe for disruption. I have experience with non-technical roles <span>(Business Development, Partnerships, Research & DD)</span> as well as technical roles <span>(Development, Compute Infrastructure, Analytics)</span>, and I am deeply committed to contributing to the advancement of Web3 technology and its potential to revolutionize the way we interact with the digital world in a more open, transparent, and free way.</p>
                </article>
              </section>
              <section className="worksSection" id="works">
                <div className="sectionHead">
                  <span>TAKE A LOOK AT MY</span>
                  <h2>PROJECTS and EXPERIENCE</h2>
                </div>
                <div className="worksContainer sectionContainer">
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image loader={customLoader} src="/home/mycdoc.png" alt="Mycelium Networks" width={500} height={500} layout="intrinsic"/>
                    </div>
                    <div className="workDescribeContainer">
                    <h3>Head of Ecosystem @ <a href="http://myceliumnetworks.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Mycelium Networks</a></h3>
                      <h4><span className="techStack">DePIN</span>, <span className="techStack">Compute</span>, <span className="techStack">Web3</span></h4>
                      <ul>
                        <li>Mycelium is an incubator & accelerator of <span className="techStack">decentralized physical infrastructure networks</span> (DePINs)</li>
                        <li>I oversaw the launch of the <span className="techStack">Mycelium Testbed</span>, the world's first physical DePIN sandbox, spanning <span className="techStack">1600+ SqMi</span> of concentrated & composable DePIN coverage in Americas Heartland.</li>
                        <li>Acedemic Research surrounding the <a href="docs/mycelium-testbed.pdf/" className="liveLink" target="_blank" rel="noopener noreferrer">Mycelium Testbed</a>, and general applications of protocol agnostic DePIN testing facilities</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image loader={customLoader} src="/home/ud.png" alt="Unleashing DePIN" width={500} height={500} layout="intrinsic"/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Head of Growth @ <a href="http://unleashingdepin.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Unleashing DePIN</a></h3>
                      <h4><span className="techStack">DePIN</span>, <span className="techStack">Growth</span>, <span className="techStack">Software Development</span></h4>
                      <ul><li>My role includes oversight of growth, operations and product development for the Unleashing DePIN brand.</li></ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image loader={customLoader} src="/home/cc.png" alt="UARK" width={500} height={500} layout="intrinsic"/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Blockchain @ University of Arkansas</h3>
                      <h4><span className="techStack">Web3</span>, <span className="techStack">Finance</span>, <span className="techStack">Computer Science</span></h4>
                      <ul>
                        <li>B.S.B.A in Information Systems, Concentration in Blockchain Enterprise Systems</li>
                        <li>Founded the <a href="https://hogsync.uark.edu/club_signup?group_type=&search=crypto&category_tags=&order=name_asc" target="_blank" rel="noopener noreferrer">UARK Crypto Club</a> - First student-led blockchain society in state of Arkansas</li>
                        <li>2nd Place, <a href="https://www.youtube.com/playlist?list=PLjrNbvbJ6nUErr0nIMOsgIRKbqTDsvwZ5" className="liveLink" target="_blank" rel="noopener noreferrer">RazorBlock</a> Hackathon - <a href="https://carpinito.id/docs/chrg.pdf" className="liveLink" target="_blank" rel="noopener noreferrer">CHRG</a>, a decentralized EV charging platform</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image loader={customLoader} src="/home/coldfront.png" alt="Mycelium Testbed" width={500} height={500} layout="intrinsic"/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Research & Experiments</h3>
                      <h4><span className="techStack">Web3</span>, <span className="techStack">DePIN</span>, <span className="techStack">Incentive Mechanisms</span></h4>
                      <ul>
                        <li>Web3 Dashboards: Leveraged <a href="https://dune.com/metalight/dewi-project-users" className="liveLink" target="_blank" rel="noopener noreferrer">Dune</a> and <a href="https://flipsidecrypto.xyz/MetaLight" className="liveLink" target="_blank" rel="noopener noreferrer">Flipside</a> to compile some of the first user growth metrics in DePIN</li>
                        <li><a href="https://twitter.com/0xMetaLight/status/1630989599488049154?s=20" className="liveLink" target="_blank" rel="noopener noreferrer">MultiNode</a>: Research around the application of low-power cluster computing in blockchain node operation.</li>
                          {/* Most blockchain nodes are deployed on personal computers. 90% of these nodes are lightweight and require less than 10% of the compute power present on a standard PC, but are deployed in such a way that their efficiency and carbon footprint reduction are not realized. */}
                        <li>Use Case Sponsor - <a href="https://www.youtube.com/playlist?list=PLjrNbvbJ6nUErr0nIMOsgIRKbqTDsvwZ5" className="liveLink" target="_blank" rel="noopener noreferrer">RazorBlock</a> Hackathon Helium Network <a href="https://carpinito.id/docs/helium-blue-light.pdf" className="liveLink" target="_blank" rel="noopener noreferrer">Blue Light</a> System</li>
                        <li><a href="https://github.com/meta-light/coldfront" className="liveLink" target="_blank" rel="noopener noreferrer">Coldfront</a>: A simple weather app that displays current conditions, as well as relevant news and predictive analysis regarding Razorbacks Baseball games</li>
                      </ul>
                    </div>
                  </article>
                  {/* <article className="workBox">
                    <div className="workImageContainer">
                      <Image loader={customLoader} src="/home/coldfront.png" alt="SolCV" width={500} height={500} layout="intrinsic"/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Development Projects</h3>
                      <h4><span className="techStack">NextJS</span>, <span className="techStack">Web3.js</span>, <span className="techStack">Ubuntu</span></h4>
                      <ul>
                        <li><a href="https://github.com/meta-light/SolCV" className="liveLink" target="_blank" rel="noopener noreferrer">SolCV</a>: A Solana based framework for creating cNFT business cards</li>
                        <li><a href="https://github.com/meta-light/meta-movies" className="liveLink" target="_blank" rel="noopener noreferrer">Meta Movies</a>: Personal movie database leveraging OMDB, built with NextJS</li>
                      </ul>
                    </div>
                  </article> */}
                  {/* maybe turn this into a timeline type thing? */}
                </div>
              </section>
              <section className="skillsSection" id="skills">
                <div className="sectionHead"><span>CHECK OUT MY</span><h2>SKILLS</h2></div>
                <div className="skillsContainer sectionContainer">
                  <ul className="skillsGrid">
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/nextjs.svg" alt="NextJS" width={256} height={256}/><p>NextJS</p></div></li>
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/node.png" alt="NodeJS" width={256} height={256}/><p>NodeJS</p></div></li>
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/react.png" alt="React JS" width={256} height={256}/><p>React</p></div></li>
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/github.png" alt="Git" width={256} height={256}/><p>Git</p></div></li>
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/linux.png" alt="Linux" width={256} height={256}/><p>Linux</p></div></li>
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/pc.png" alt="Analytics" width={256} height={256}/><p>Analytics</p></div></li>
                    <li><div className="itemContainer"><Image loader={customLoader} src="/home/icons/stonks.png" alt="SQL" width={256} height={256}/><p>SQL</p></div></li>
                  </ul>
                </div>
              </section>
              <section className="contactSection" id="contact">
                <div className="sectionHead"><span>SAY HELLO</span><h2>CONTACT</h2></div>
                <div className="contactContainer sectionContainer">
                  <h3>Get in Touch</h3>
                  <div className="contactTypes">
                    <div className="flexContainer"><div className="typeBox"><i className="lni lni-envelope"></i><a href="mailto:nick@carpinito.id">nick@carpinito.id</a><p>Email Me</p></div></div>
                    <div className="flexContainer"><div className="typeBox"><i className="lni lni-calendar"></i><a href="https://calendly.com/nickcarp/30min" target="_blank" rel="noopener noreferrer">Calendly</a><p>Schedule a Meeting</p></div></div>
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
