"use client"
import React, { useEffect } from 'react';
import Head from 'next/head';
import './styles/styles.css';
import './styles/scss/styles.scss';
import './styles/LineIcons.css';
import Sidebar from '../home/sidebar';
import MenuButton from '../home/MenuButton';
import Header from '../home/Header';
import About from '../home/About';
import Works from '../home/Works';
import Skills from '../home/Skills';
import Contact from '../home/Contact';

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
        <MenuButton />
        <Sidebar/>
        <div className="outerWrapper"> 
          <div className="innerWrapper">
            <Header />
            <main>
              <About />
              <Works />
              <Skills />
              <Contact />
            </main>
          </div>
        </div>
        <script src="https://code.jquery.com/jquery-3.5.1.js" integrity="sha256-QWo7LDvxbWT2tbbQ97B53yJnYU3WhH/C8ycbRAkjPDc=" crossOrigin="anonymous"></script>
      </body>
    </>
  );
}

export default Home;
