"use client"
import React from 'react';
import Link from 'next/link';

const Sidebar = () => {
  return (
    <aside className="sideMenu sideMenuShow" id="sideMenu"> 
      <p className="logo">NC</p>
      <nav>
        <ul className="navBar">
          {/* https://lineicons.com/icons */}
          <li className="homeNav"><Link href="#home" className="navItem"><i className="lni lni-home"></i><span className="navItemName">HOME</span></Link></li>
          <li className="aboutNav"><Link href="#about" className="navItem"><i className="lni lni-user"></i><span className="navItemName">ABOUT</span></Link></li>
          <li className="worksNav"><Link href="#works" className="navItem"><i className="lni lni-briefcase"></i><span className="navItemName">EXPERIENCE</span></Link></li>
          <li className="skillsNav"><Link href="#skills" className="navItem"><i className="lni lni-code-alt"></i><span className="navItemName">SKILLS</span></Link></li>
          <li className="contactNav"><Link href="#contact" className="navItem"><i className="lni lni-phone"></i><span className="navItemName">CONTACT</span></Link></li>
          <li className="gptNav"><Link href="/Card" className="navItem"><i className="lni lni-code-alt"></i><span className="navItemName">BIZ CARD</span></Link></li>
          <li className="gptNav"><a href="/capital" className="navItem"><i className="lni lni-coin"></i><span className="navItemName">CARP CAP</span></a></li>
          <li className="gptNav"><a href="/pines" className="navItem"><i className="lni lni-tree"></i><span className="navItemName">PINES</span></a></li>
          {/* <li className="gptNav"><a href="/tools" className="navItem"><i className="lni lni-ruler-alt"></i><span className="navItemName">TOOLS</span></a></li> */}
        </ul>
      </nav>
      <div className="scrollDown" id="scrollDown"></div>
    </aside>
  );
}

export default Sidebar;