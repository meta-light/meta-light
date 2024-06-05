import Head from 'next/head';
import Script from 'next/script';
import '../styles/capital/css/main.css'
import '../styles/capital/css/noscript.css'
import '../styles/capital/css/fontawesome-all.min.css'
import '../styles/capital/sass/noscript.scss'
import '../styles/capital/sass/main.scss'

export default function Capital() {

  return (
    <>
        <Head>
            <title>Carp Capital</title>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
            <style>{`body { overflow: 'hidden'; } #team { text-align: 'center'; }`}</style>
        </Head>
            <div id="wrapper" className="is-preload" style={{ overflowY: 'scroll' }}>
                <header id="header">
                    <div className="logo"><img src="capital/grey-c.svg"/></div>
                    <div className="content">
                        <div className="inner">
                            <h1>Carp Cap</h1>
                            <p>Supporting founders and projects that disrupt incumbent offerings through distributed networks</p>
                            <p>Most are whales, we are carp</p>
                        </div>
                    </div>
                    <nav>
                        <ul>
                            <li><a href="#thesis">Thesis</a></li>
                            <li><a href="#research">research</a></li>
                            <li><a href="#ecosystem">ecosystem</a></li>
                            <li><a href="#team">team</a></li>
                        </ul>
                    </nav>
                </header>
                <div id="main">
                    <article id="thesis">
                        <section>
                            <h4>Thesis</h4>
                            <blockquote>We believe in the inherent capabilities of unique and equitable Web3 incentive structures to disrupt legacy systems of governance and reward mechanisms. The emergence of high-throughput blockchain infrastructure paired with the advent of token-incentivized DePINs present opportunities to revolutionize the status quo in the creation for a more fair, clean and transparent future.</blockquote>
                        </section>
                        <section>
                            <h4>CarpCap Ecosystem</h4>
                            <div className="table-wrapper">
                                <table className="alt">
                                    <thead><tr><th>Category</th><th>Think</th></tr></thead>
                                    <tbody>
                                        <tr><td>Decentralized Physical Infrastructure Networks (DePIN)</td><td>Helium, DIMO, Hivemapper, WeatherXM</td></tr>
                                        <tr><td>Decentralized Virtual Infrastructure Networks (DeVIN)</td><td>Urbit, Holium, AirTOR</td></tr>
                                        <tr><td>High-Performance Blockchains</td><td>Solana, Eclipse, Sui, Aptos</td></tr>
                                        <tr><td>Next-Gen Proof of Work (PoW)</td><td>Tari, Ironfish</td></tr>
                                        <tr><td>Sovereign Computing</td><td>Urbit, Holium, AirTOR</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </article>
                    <article id="research">
                        <h2 className="major">research</h2>
                        <p><a href="https://carpinito.id/assets/mycelium-testbed.pdf/"><strong>Mycelium Testbed: A Comprehensive Platform for DePIN</strong></a></p>
                        <p><a href="docs/memos/shdwdrive.pdf"><strong>shdwDrive Investment Memo</strong></a></p>
                        <p><a href="docs/memos/eclipse.pdf"><strong>Eclipse Investment Memo</strong></a></p>
                        <p><a href="docs/memos/tari.pdf"><strong>Tari Investment Memo</strong></a></p>
                        <p><a href="docs/memos/helium-mobile.pdf"><strong>Helium Mobile Investment Memo</strong></a></p>
                    </article>
                    <article id="ecosystem">
                        <h2 className="major">Ecosystem</h2>
                        <img src="capital/mycelium.png" alt="" style={{ width: '35%', display: 'center' }}/>
                        <img src="capital/sov-white.png" alt="" style={{ width: '25%' }}/>
                        <img src="capital/ud.png" alt="" style={{ width: '25%' }}/>
                    </article>
                    <article id="team">
                        <h2 className="major">team</h2>
                        <img src="capital/VAcRFW7lB18WknaQOGScvFGB2C6jH4khS7VKnMXYiNo.jpg" alt="" style={{ width: '25%' }}/>
                        <p><strong>Nick Carpinito (Meta Light)</strong></p>
                        <p>Head of Ecosystem - Mycelium Networks</p>                                
                    </article>
                </div>
                <footer id="footer">
                    <p className="copyright">&copy; Carp Capital</p>
                    <br/>
                    <ul className="icons">
                        <li><a href="https://twitter.com/0xMetaLight/" className="icon brands fa-twitter"><span className="label">Twitter</span></a></li>
                        <li><a href="https://www.linkedin.com/in/nick-carpinito/" className="icon brands fa-linkedin in"><span className="label">LinkedIn</span></a></li>
                        <li><a href="https://medium.com/@meta-light" className="icon brands fa-medium m"><span className="label">Medium</span></a></li>
                        <li><a href="https://github.com/meta-light" className="icon brands fa-github"><span className="label">GitHub</span></a></li>
                    </ul>
                </footer>
            </div>
            <div id="bg"></div>
            <Script src="scripts/capital/jquery.min.js"></Script>
            <Script src="scripts/capital/browser.min.js"></Script>
            <Script src="scripts/capital/breakpoints.min.js"></Script>
            <Script src="scripts/capital/util.js"></Script>
            <Script src="scripts/capital/main.js"></Script>
    </>
  );
}