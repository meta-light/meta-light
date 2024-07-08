import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Nick Carpinito</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css" />
      </Head>
      <div className="w3-content" style={{ maxWidth: '1300px' }}>
        <div className="w3-row"> {/* Menu and About */}
          <div className="w3-half w3-black w3-container w3-center" style={{ height: '700px' }}>
            <div className="w3-padding-64">
              <img src="https://www.arweave.net/VAcRFW7lB18WknaQOGScvFGB2C6jH4khS7VKnMXYiNo?ext=jpg" style={{ width: '20%' }} />
              <h1>Nick Carpinito</h1>
              <h1>(Meta-Light)</h1>
            </div>
            <div className="w3-padding-64">
              <a href="#" className="w3-button w3-black w3-block w3-hover-blue-grey w3-padding-16">Home</a>
              <a href="#about" className="w3-button w3-black w3-block w3-hover-teal w3-padding-16">About Me</a>
              <a href="#experience" className="w3-button w3-black w3-block w3-hover-dark-grey w3-padding-16">Experience and Projects</a>
              <a href="#links" className="w3-button w3-black w3-block w3-hover-brown w3-padding-16">Contact and Links</a>
            </div>
          </div>
          <div className="w3-half w3-blue-grey w3-container" style={{ height: '700px' }}>
            <div className="w3-padding-64 w3-center" id="about">
              <h1>About Me</h1>
              <img src="/w3images/avatar3.png" className="w3-margin w3-circle" alt="" style={{ width: '50%' }} />
              <div className="w3-left-align w3-padding-large">
                <p>Howdy! I’m Nick, a Web3 Researcher and Biz Dev Lead focused on DePIN networks, Privacy tech and Web3 onboarding tools. I’ve been working in Web3 for about 3 years and have been tracking the emergence of the DePIN sector and how it has begun to affect legacy industries that are ripe for disruption.</p>
                <p>I have experience with non-technical roles (Business Development, Sales, Marketing, Partnerships) as well as technical roles (Development, Running Nodes and Validators, Linux, CLI’s and Analytics), and always focus on extracting maximum value for myself and my team.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="w3-row">
          <div className="w3-half w3-indigo w3-container" style={{ minHeight: '700px' }}>
            <div className="w3-padding-64 w3-center" id="experience">
              <h2>Experience and Projects</h2>
              <div className="w3-container w3-responsive">
                <table className="w3-table">
                  <thead>
                    <tr><th>Year</th><th>Title</th><th>Location</th></tr>
                  </thead>
                  <tbody>
                    <tr className="w3-white" key="1"><td>2021 - Present</td><td>Head of Research, Mycelium Networks</td><td>Fayetteville, Arkansas</td></tr>
                    <tr className="w3-white" key="2"><td>2020 - 2023</td><td>Co-Founder, UARK Crypto Club</td><td>Fayetteville, Arkansas</td></tr>
                    <tr className="w3-white" key="3"><td>2019 - 2023</td><td>B.S.B.A in Information Systems, Concentration in Blockchain</td><td>University of Arkansas - Fayetteville, Arkansas</td></tr>
                  </tbody>
                </table>
                <div>
                  <a href="https://github.com/meta-lite/meta-lite"><p>Onramp:</p></a><p>A permissionless repository of resources to onboard Web3 talent.</p>
                  <a href="https://github.com/meta-lite/meta-lite/blob/main/projects/sol-cv/sol-cv.md"><p>SolCV:</p></a><p>An xNFT backpack app that serves as a contacts app for Web3.</p>
                  <a href="https://github.com/meta-lite/meta-lite/blob/main/projects/chegg3/chegg3-whitepaper.md"><p>Chegg3:</p></a><p>A tokenized Web3 replacement to the current suite of available EdTech products.</p>
                </div> {/* Closing div for the project descriptions */}
              </div> {/* Closing div for the responsive container */}
            </div> {/* Closing div for the experience section */}
          </div>
          <div className="w3-half w3-teal w3-container w3-center" style={{ height: '700px' }} id="links">
            <div className="w3-padding-64 w3-padding-large">
              <h1>Contact and Links</h1>
              <div>
                <a href="https://dune.com/metalight"><img src="https://assets-global.website-files.com/6364e65656ab107e465325d2/637aebc6d755b0eae6379976_i8sHBBmonZ3jVMbzzDvWi9GCQj5SrmnJbb8XodvRZR4.png" style={{ width: '10%' }} /></a>
                <a href="https://github.com/meta-lite"><img src="https://cdn.iconscout.com/icon/free/png-512/github-1521488-1288230.png?" style={{ width: '10%' }} /></a>
                <a href="https://twitter.com/MetOfLight"><img src="https://cdn.iconscout.com/icon/free/png-512/twitter-1543562-1306065.png?" style={{ width: '10%' }} /></a>
              </div>
              <a href="https://www.linkedin.com/in/nicholas-carpinito-b7584b18b/"><img src="https://cdn.iconscout.com/icon/free/png-512/linkedin-1521491-1288233.png?" style={{ width: '10%' }} /></a>
              <a href="https://medium.com/@meta-light"><img src="https://cdn.iconscout.com/icon/free/png-256/medium-1521487-1288229.png?" style={{ width: '14%' }} /></a>
              <div className="w3-padding-64">
                <a href="https://calendly.com/nickcarp/30min"><img src="https://cdn.iconscout.com/icon/free/png-256/calender-1439791-1214121.png?" style={{ width: '10%' }} /></a>
                <a href="https://t.me/metalight7"><img src="https://cdn.iconscout.com/icon/free/png-256/telegram-1660431-1408699.png?" style={{ width: '10%' }} /></a>
                <a href="https://discordapp.com/users/436483241453682689"><img src="https://cdn.iconscout.com/icon/free/png-256/discord-2474816-2056055.png?" style={{ width: '10%' }} /></a>
                <p>Fayetteville, AR</p>
                <p>carpinitoventures@gmail.com</p>
              </div> {/* Closing div for the contact and links section */}
            </div> {/* Closing div for the padding-large */}
          </div> {/* Closing div for the teal container */}
        </div> {/* Closing div for the row */}
      </div> {/* Closing div for the content */}
    </>
  );
}