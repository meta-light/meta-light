import Head from 'next/head';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import '../styles/capital/sass/main.scss'
import '../styles/capital/css/fontawesome-all.min.css'
import '../styles/capital/sass/noscript.scss'


export default function capital() {
	const [isLoaded, setIsLoaded] = useState(false);
	useEffect(() => {const timer = setTimeout(() => {document.body.classList.remove('is-preload'); setIsLoaded(true);}, 100); return () => clearTimeout(timer);}, []);
    return (
        <>
            <Head><title>Carp Capital</title><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
            </Head>
            <div id="wrapper" className={isLoaded ? 'loaded' : ''}>
                <header id="header">
                    <div className="logo"><img src="capital/grey-c.svg"/></div>
                    <div className={`content ${isLoaded ? 'loaded' : ''}`}>
                        <div className="inner"><h1>Carp Cap</h1><p>Most are whales, we are carp</p></div>
                    </div>
                    <nav><ul><li><a href="#thesis">thesis</a></li><li><a href="#research">research</a></li><li><a href="#ecosystem">ecosystem</a></li><li><a href="#team">me</a></li></ul></nav>
                </header>
                <div id="main">
							<article id="thesis">
								<section>
									<h4>A Qualitative Liquid Investment and Research Form (QLIRF) for Crypto Analysis</h4>
								</section>
								<section>
									<h4>Thesis</h4>
									<blockquote>
										We believe in leveraging qualitative data and innovative approaches to create unique insights in the crypto space. By combining on-chain analysis with real-world indicators, we aim to identify opportunities that others might miss.
									</blockquote>
								</section>
								<section>
									<h4>CarpCap Approach</h4>
									<ul>
										<li>Qualitative data from diverse sources (job postings, social media, podcasts, Big Mac Index) to create inferences</li>
										<li>Running servers for mining/farming to generate earned funds</li>
										<li>VC investing using only earned funds, without reliance on external investors</li>
										
									</ul>
								</section>
							</article>
							<article id="research">
								<h2 className="major">research</h2>
								<p><a href="docs"><strong>Mycelium Testbed: A Comprehensive Platform for DePIN</strong></a></p>
								<p><a href="docs/memos/shdwdrive.pdf"><strong>shdwDrive Investment Memo</strong></a></p>
								<p><a href="docs/memos/eclipse.pdf"><strong>Eclipse Investment Memo</strong></a></p>
								<p><a href="docs/memos/tari.pdf"><strong>Tari Investment Memo</strong></a></p>
								<p><a href="docs/memos/helium-mobile.pdf"><strong>Helium Mobile Investment Memo</strong></a></p>
								<p><a href="docs/qlirf-methodology.pdf"><strong>QLIRF Methodology: Combining Qualitative Data with On-Chain Analysis</strong></a></p>
								<p><a href="docs/earned-funds-vc.pdf"><strong>The Earned Funds VC Model: Sustainable Crypto Investing</strong></a></p>
							</article>
							<article id="ecosystem">
								<h2 className="major">Ecosystem</h2>
								<p>Our ecosystem spans various areas of the crypto space, including:</p>
								<ul>
									<li>Decentralized Physical Infrastructure Networks (DePIN)</li>
									<li>Decentralized Virtual Infrastructure Networks (DeVIN)</li>
									<li>High-Performance Blockchains</li>
									<li>Next-Gen Proof of Work (PoW)</li>
									<li>Sovereign Computing</li>
									<li>Qualitative Data Analysis Tools</li>
									<li>Mining and Farming Operations</li>
								</ul>
							</article>
							<article id="team">
								<h2 className="major">team</h2>
								<img src="home/dewi-cat.gif" alt="" width="25%"/>
								<p><strong>Nick Carpinito (Meta Light)</strong></p>
								<p>Head of Ecosystem - Mycelium Networks</p>								
							</article>
					</div>
					<footer id="footer">
						<p className="copyright">&copy; Carp Capital</p>
						<ul className="icons">
							<li><a href="https://twitter.com/0xMetaLight/" className="icon brands fa-twitter"><span className="label">Twitter</span></a></li>
							<li><a href="https://www.linkedin.com/in/nick-carpinito/" className="icon brands fa-linkedin in"><span className="label">LinkedIn</span></a></li>
							<li><a href="https://medium.com/@meta-light" className="icon brands fa-medium m"><span className="label">Medium</span></a></li>
							<li><a href="https://github.com/meta-light" className="icon brands fa-github"><span className="label">GitHub</span></a></li>
						</ul>
					</footer>
			</div>
            <div id="bg"/>
			<Script src="/capital/scripts/jquery.min.js" strategy="beforeInteractive"/>
			<Script src="/capital/scripts/breakpoints.min.js" strategy="beforeInteractive"/>
			<Script src="/capital/scripts/browser.min.js" strategy="beforeInteractive"/>
			<Script src="/capital/scripts/util.js" strategy="beforeInteractive"/>
			<Script src="/capital/scripts/main.js" strategy="afterInteractive"/>
        </>
    );
}