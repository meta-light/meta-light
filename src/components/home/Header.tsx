import React from 'react';
import Image from 'next/image';

const Header = () => {
  return (
    <header>
      <div className="heroImageContainer">
        <Image src="/home/dewi-cat.gif" alt="Dewi Cat" width={500} height={500} unoptimized/>
      </div>
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
  );
};

export default Header; 