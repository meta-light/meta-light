import React from 'react';

const Contact = () => {
  return (
    <section className="contactSection" id="contact">
      <div className="sectionHead"><span></span><h2>CONTACT</h2></div>
      <div className="contactContainer sectionContainer">
        <div className="contactTypes">
          <div className="flexContainer">
            <div className="typeBox">
              <i className="lni lni-envelope"></i>
              <a href="mailto:nick@carpinito.id">nick@carpinito.id</a>
              <p>Email Me</p>
            </div>
          </div>
          <div className="flexContainer">
            <div className="typeBox">
              <i className="lni lni-calendar"></i>
              <a href="https://carp.youcanbook.me/" target="_blank" rel="noopener noreferrer">Calendar</a>
              <p>Schedule a Meeting</p>
            </div>
          </div>
        </div>
      </div> 
    </section>
  );
};

export default Contact; 