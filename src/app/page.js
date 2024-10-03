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
                <p className="greeting">Howdy! I'm</p>
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
                <div className="sectionHead"><span>SOME INFO</span><h2>ABOUT ME</h2></div>
                <article className="aboutContainer sectionContainer">
                  <p>
                    I'm a Web3 Researcher and Ecosystem Developer focused on <span>DePIN, Web3 Compute, and High-Performance Infrastructure</span>. 
                    Over the past four years, I have been at the forefront of Web3 innovation, tracking the evolution of the DePIN/DeVIN sectors and their transformative impact on legacy industries poised for disruption. 
                    My experience encompasses a wide range of roles, including Business Development, Partnerships, Research, Due Diligence, Development, and Analytics. 
                    I am deeply committed to advancing Web3 technology and its potential to revolutionize the world by fostering greater openness, transparency, and freedom in our interactions.
                  </p>
                </article>
              </section>
              <section className="worksSection" id="works">
                <div className="sectionHead">
                  <span>TAKE A LOOK AT MY</span>
                  <h2>PROJECTS and EXPERIENCE</h2>
                </div>
                <div className="worksContainer sectionContainer">
                  <article className="workBox">
                    <div className="workImageContainer"><Image src="/home/mycelium.png" alt="Mycelium Networks" width={500} height={500} unoptimized/></div>
                    <div className="workDescribeContainer">
                      <h3>Head of Ecosystem @ <a href="http://myceliumnetworks.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Mycelium Networks</a></h3><h4><span className="techStack">DePIN</span>, <span className="techStack">Compute</span>, <span className="techStack">Research</span></h4>
                      <ul>
                        <li>Mycelium is an incubator & accelerator of <span className="techStack">decentralized physical infrastructure networks</span> (DePINs).</li>
                        <li>Oversaw the launch of the <a href="http://myceliumnetworks.com/testbed/" target="_blank" rel="noopener noreferrer" className='h3Style'>Mycelium Testbed</a>, the world's first physical DePIN sandbox, spanning <span className="techStack">1600+ SqMi</span> of concentrated & composable DePIN coverage in Americas Heartland.</li>
                        <li>Conducted academic research surrounding the <a href="/docs/mycelium-testbed.pdf/" className="liveLink" target="_blank" rel="noopener noreferrer">Mycelium Testbed</a>, and general applications of protocol agnostic DePIN testing facilities.</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer"><Image src="/home/ud.png" alt="Unleashing DePIN" width={500} height={500} unoptimized/></div>
                    <div className="workDescribeContainer">
                      <h3>Head of Growth @ <a href="http://unleashingdepin.com/" target="_blank" rel="noopener noreferrer" className='h3Style'>Unleashing DePIN</a></h3><h4><span className="techStack">DePIN</span>, <span className="techStack">Growth</span>, <span className="techStack">Software Development</span></h4>
                      <ul>
                        <li>Oversight of growth, operations, and product development, driving the brand's expansion and technological advancements in the DePIN space.</li>
                        <li>Developed <a href="https://depinpulse.app/" className="liveLink" target="_blank" rel="noopener noreferrer">DePIN Pulse</a>, a DePIN ecosystem opportunities aggregator and research tool.</li>
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
                        <li>Secured 2nd Place at the <a href="https://www.youtube.com/playlist?list=PLjrNbvbJ6nUErr0nIMOsgIRKbqTDsvwZ5" className="liveLink" target="_blank" rel="noopener noreferrer">RazorBlock Hackathon</a> with <a href="/docs/chrg.pdf" className="liveLink" target="_blank" rel="noopener noreferrer">CHRG</a>, a decentralized EV charging platform</li>
                      </ul>
                    </div>
                  </article>
                  <article className="workBox">
                    <div className="workImageContainer">
                      <Image src="/home/coldfront.png" alt="Mycelium Testbed" width={500} height={500} unoptimized/><br/><br/>
                      <Image src="/home/movie.png" alt="Mycelium Testbed" width={500} height={500} unoptimized/>
                    </div>
                    <div className="workDescribeContainer">
                      <h3>Research & Experiments</h3>
                      <h4><span className="techStack">Web3</span>, <span className="techStack">DePIN</span>, <span className="techStack">Incentive Mechanisms</span></h4>
                      <ul>
                        <h4><span className="techStack">2024</span></h4>
                        <li>Explored compressed NFTs on Solana with <a href="/basket" className="liveLink" target="_blank" rel="noopener noreferrer">CNFT Basket</a>, a tool for creating tradable "baskets" of compressed NFTs.</li>
                        <h4><span className="techStack">2023</span></h4>
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
                <div className="sectionHead"><span>CHECK OUT MY</span><h2>SKILLS</h2></div>
                <div className="skillsContainer sectionContainer">
                  <ul className="skillsGrid">
                    <li><div className="itemContainer"><Image src="/home/icons/nextjs.svg" alt="NextJS" width={256} height={256} unoptimized/><p>NextJS</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/node.png" alt="NodeJS" width={256} height={256} unoptimized/><p>NodeJS</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/react.png" alt="React JS" width={256} height={256} unoptimized/><p>React</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/github.png" alt="Git" width={256} height={256} unoptimized/><p>Git</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/linux.png" alt="Linux" width={256} height={256} unoptimized/><p>Linux</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/pc.png" alt="Analytics" width={256} height={256} unoptimized/><p>Analytics</p></div></li>
                    <li><div className="itemContainer"><Image src="/home/icons/stonks.png" alt="SQL" width={256} height={256} unoptimized/><p>SQL</p></div></li>
                  </ul>
                </div>
              </section>
              <section className="contactSection" id="contact">
                <div className="sectionHead"><span>SAY HELLO</span><h2>CONTACT</h2></div>
                <div className="contactContainer sectionContainer">
                  <h3>Get in Touch</h3>
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
