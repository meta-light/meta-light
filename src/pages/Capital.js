import Head from 'next/head';
import Script from 'next/script';
import { useState } from 'react';
import '../styles/capital/css/main.css'
import '../styles/capital/css/noscript.css'
// import '../styles/capital/css/fontawesome-all.min.css'
// import '../styles/capital/sass/noscript.scss'
// import '../styles/capital/sass/main.scss'

export default function Capital() {
    const [activeSection, setActiveSection] = useState(null);
    const togglePopup = (section) => {setActiveSection(activeSection === section ? null : section);};
    return (
        <>
            <Head>
                <title>Carp Capital</title>
                <meta charset="utf-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no"/>
            </Head>
            <div id="wrapper">
                {!activeSection && (
                    <>
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
                                    <li><a href="#thesis" onClick={(e) => { e.preventDefault(); togglePopup('thesis'); }}>Thesis</a></li>
                                    <li><a href="#research" onClick={(e) => { e.preventDefault(); togglePopup('research'); }}>Research</a></li>
                                    <li><a href="#ecosystem" onClick={(e) => { e.preventDefault(); togglePopup('ecosystem'); }}>Ecosystem</a></li>
                                    <li><a href="#team" onClick={(e) => { e.preventDefault(); togglePopup('team'); }}>Team</a></li>
                                </ul>
                            </nav>
                        </header>
                        <footer id="footer">
                            <p className="copyright">&copy; Carp Capital</p><br/>
                            <ul className="icons">
                                <li><a href="https://twitter.com/0xMetaLight/" className="icon brands fa-twitter"><span className="label">Twitter</span></a></li>
                                <li><a href="https://www.linkedin.com/in/nick-carpinito/" className="icon brands fa-linkedin in"><span className="label">LinkedIn</span></a></li>
                                <li><a href="https://medium.com/@meta-light" className="icon brands fa-medium m"><span className="label">Medium</span></a></li>
                                <li><a href="https://github.com/meta-light" className="icon brands fa-github"><span className="label">GitHub</span></a></li>
                            </ul>
                        </footer>
                    </>
                )}
                <div id="main">
                    {activeSection && (
                        <div className="popup" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 }}>
                            {activeSection === 'thesis' && (
                                <article id="thesis" className="active">
                                    <button onClick={() => setActiveSection(null)} style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '50px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px' }}>&times;</button>
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
                            )}
                            {activeSection === 'research' && (
                                <article id="research" className="active">
                                    <button onClick={() => setActiveSection(null)} style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '50px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px' }}>&times;</button>
                                    <h2 className="major">research</h2>
                                    <p><a href="https://carpinito.id/assets/mycelium-testbed.pdf/"><strong>Mycelium Testbed: A Comprehensive Platform for DePIN</strong></a></p>
                                    <p><a href="docs/memos/shdwdrive.pdf"><strong>shdwDrive Investment Memo</strong></a></p>
                                    <p><a href="docs/memos/eclipse.pdf"><strong>Eclipse Investment Memo</strong></a></p>
                                    <p><a href="docs/memos/tari.pdf"><strong>Tari Investment Memo</strong></a></p>
                                    <p><a href="docs/memos/helium-mobile.pdf"><strong>Helium Mobile Investment Memo</strong></a></p>
                                </article>
                            )}
                            {activeSection === 'ecosystem' && (
                                <article id="ecosystem" className="active">
                                    <button onClick={() => setActiveSection(null)} style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '50px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px' }}>&times;</button>
                                    <h2 className="major">Ecosystem</h2>
                                    <img src="capital/mycelium.png" alt="" style={{ width: '35%', display: 'center' }}/>
                                    <img src="capital/sov-white.png" alt="" style={{ width: '25%' }}/>
                                    <img src="capital/ud.png" alt="" style={{ width: '25%' }}/>
                                </article>
                            )}
                            {activeSection === 'team' && (
                                <article id="team" className="active">
                                    <button onClick={() => setActiveSection(null)} style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '50px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px' }}>&times;</button>
                                    <h2 className="major">team</h2>
                                    <img src="capital/VAcRFW7lB18WknaQOGScvFGB2C6jH4khS7VKnMXYiNo.jpg" alt="" style={{ width: '25%' }}/>
                                    <p><strong>Nick Carpinito (Meta Light)</strong></p>
                                    <p>Head of Ecosystem - Mycelium Networks</p>  
                                </article>
                            )}
                        </div>
                    )}
                </div>

            </div>
            <div id="bg"/>
            <Script src="/scripts/capital/jquery.min.js" strategy="beforeInteractive"/>
            <Script src="/scripts/capital/browser.min.js" strategy="beforeInteractive"/>
            <Script src="/scripts/capital/breakpoints.min.js" strategy="beforeInteractive"/>
            <Script src="/scripts/capital/util.js" strategy="beforeInteractive"/>
            <Script src="/scripts/capital/main.js" strategy="afterInteractive"/>
        </>
    );
}

// example code
// <html>
// 	<head>
// 		<title>Carpinito Capital</title>
// 		<meta charset="utf-8"/>
// 		<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
// 		<link rel="stylesheet" href="assets/css/main.css" />
// 		<noscript><link rel="stylesheet" href="assets/css/noscript.css" /></noscript>
// 	</head>
// 	<body class="is-preload">
// 			<div id="wrapper">
// 					<header id="header">
// 						<div class="logo"><span class="icon fa-gem"></span></div>
// 						<div class="content">
// 							<div class="inner">
// 								<h1>Carp Cap</h1>
// 								<p>A fully responsive site template designed by <a href="https://html5up.net">HTML5 UP</a> and released<br />
// 								for free under the <a href="https://html5up.net/license">Creative Commons</a> license.</p>
// 							</div>
// 						</div>
// 						<nav>
// 							<ul>
// 								<li><a href="#intro">Intro</a></li>
// 								<li><a href="#work">Work</a></li>
// 								<li><a href="#about">About</a></li>
// 								<li><a href="#contact">Contact</a></li>
// 							</ul>
// 						</nav>
// 					</header>
// 					<div id="main">
// 							<article id="intro">
// 								<h2 class="major">Intro</h2>
// 								<span class="image main"><img src="images/pic01.jpg" alt="" /></span>
// 								<p>Aenean ornare velit lacus, ac varius enim ullamcorper eu. Proin aliquam facilisis ante interdum congue. Integer mollis, nisl amet convallis, porttitor magna ullamcorper, amet egestas mauris. Ut magna finibus nisi nec lacinia. Nam maximus erat id euismod egestas. By the way, check out my <a href="#work">awesome work</a>.</p>
// 								<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis dapibus rutrum facilisis. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Etiam tristique libero eu nibh porttitor fermentum. Nullam venenatis erat id vehicula viverra. Nunc ultrices eros ut ultricies condimentum. Mauris risus lacus, blandit sit amet venenatis non, bibendum vitae dolor. Nunc lorem mauris, fringilla in aliquam at, euismod in lectus. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. In non lorem sit amet elit placerat maximus. Pellentesque aliquam maximus risus, vel sed vehicula.</p>
// 							</article>
// 							<article id="work">
// 								<h2 class="major">Work</h2>
// 								<span class="image main"><img src="images/pic02.jpg" alt="" /></span>
// 								<p>Adipiscing magna sed dolor elit. Praesent eleifend dignissim arcu, at eleifend sapien imperdiet ac. Aliquam erat volutpat. Praesent urna nisi, fringila lorem et vehicula lacinia quam. Integer sollicitudin mauris nec lorem luctus ultrices.</p>
// 								<p>Nullam et orci eu lorem consequat tincidunt vivamus et sagittis libero. Mauris aliquet magna magna sed nunc rhoncus pharetra. Pellentesque condimentum sem. In efficitur ligula tate urna. Maecenas laoreet massa vel lacinia pellentesque lorem ipsum dolor. Nullam et orci eu lorem consequat tincidunt. Vivamus et sagittis libero. Mauris aliquet magna magna sed nunc rhoncus amet feugiat tempus.</p>
// 							</article>
// 							<article id="about">
// 								<h2 class="major">About</h2>
// 								<span class="image main"><img src="images/pic03.jpg" alt="" /></span>
// 								<p>Lorem ipsum dolor sit amet, consectetur et adipiscing elit. Praesent eleifend dignissim arcu, at eleifend sapien imperdiet ac. Aliquam erat volutpat. Praesent urna nisi, fringila lorem et vehicula lacinia quam. Integer sollicitudin mauris nec lorem luctus ultrices. Aliquam libero et malesuada fames ac ante ipsum primis in faucibus. Cras viverra ligula sit amet ex mollis mattis lorem ipsum dolor sit amet.</p>
// 							</article>
// 							<article id="contact">
// 								<h2 class="major">Contact</h2>
// 								<form method="post" action="#">
// 									<div class="fields">
// 										<div class="field half">
// 											<label for="name">Name</label>
// 											<input type="text" name="name" id="name" />
// 										</div>
// 										<div class="field half">
// 											<label for="email">Email</label>
// 											<input type="text" name="email" id="email" />
// 										</div>
// 										<div class="field">
// 											<label for="message">Message</label>
// 											<textarea name="message" id="message" rows="4"></textarea>
// 										</div>
// 									</div>
// 									<ul class="actions">
// 										<li><input type="submit" value="Send Message" class="primary" /></li>
// 										<li><input type="reset" value="Reset" /></li>
// 									</ul>
// 								</form>
// 								<ul class="icons">
// 									<li><a href="#" class="icon brands fa-twitter"><span class="label">Twitter</span></a></li>
// 									<li><a href="#" class="icon brands fa-facebook-f"><span class="label">Facebook</span></a></li>
// 									<li><a href="#" class="icon brands fa-instagram"><span class="label">Instagram</span></a></li>
// 									<li><a href="#" class="icon brands fa-github"><span class="label">GitHub</span></a></li>
// 								</ul>
// 							</article>
// 							<article id="elements">
// 								<h2 class="major">Elements</h2>
// 								<section>
// 									<h3 class="major">Text</h3>
// 									<p>This is <b>bold</b> and this is <strong>strong</strong>. This is <i>italic</i> and this is <em>emphasized</em>.
// 									This is <sup>superscript</sup> text and this is <sub>subscript</sub> text.
// 									This is <u>underlined</u> and this is code: <code>for (;;) { ... }</code>. Finally, <a href="#">this is a link</a>.</p>
// 									<hr />
// 									<h2>Heading Level 2</h2>
// 									<h3>Heading Level 3</h3>
// 									<h4>Heading Level 4</h4>
// 									<h5>Heading Level 5</h5>
// 									<h6>Heading Level 6</h6>
// 									<hr />
// 									<h4>Blockquote</h4>
// 									<blockquote>Fringilla nisl. Donec accumsan interdum nisi, quis tincidunt felis sagittis eget tempus euismod. Vestibulum ante ipsum primis in faucibus vestibulum. Blandit adipiscing eu felis iaculis volutpat ac adipiscing accumsan faucibus. Vestibulum ante ipsum primis in faucibus lorem ipsum dolor sit amet nullam adipiscing eu felis.</blockquote>
// 									<h4>Preformatted</h4>
// 									<pre><code>
// 										i = 0;
// 										while (!deck.isInOrder()) {
// 											print 'Iteration ' + i;
// 											deck.shuffle();
// 											i++;
// 										}
// 										print 'It took ' + i + ' iterations to sort the deck.';
// 									</code></pre>
// 								</section>
// 								<section>
// 									<h3 class="major">Lists</h3>
// 									<h4>Unordered</h4>
// 									<ul>
// 										<li>Dolor pulvinar etiam.</li>
// 										<li>Sagittis adipiscing.</li>
// 										<li>Felis enim feugiat.</li>
// 									</ul>
// 									<h4>Alternate</h4>
// 									<ul class="alt">
// 										<li>Dolor pulvinar etiam.</li>
// 										<li>Sagittis adipiscing.</li>
// 										<li>Felis enim feugiat.</li>
// 									</ul>
// 									<h4>Ordered</h4>
// 									<ol>
// 										<li>Dolor pulvinar etiam.</li>
// 										<li>Etiam vel felis viverra.</li>
// 										<li>Felis enim feugiat.</li>
// 										<li>Dolor pulvinar etiam.</li>
// 										<li>Etiam vel felis lorem.</li>
// 										<li>Felis enim et feugiat.</li>
// 									</ol>
// 									<h4>Icons</h4>
// 									<ul class="icons">
// 										<li><a href="#" class="icon brands fa-twitter"><span class="label">Twitter</span></a></li>
// 										<li><a href="#" class="icon brands fa-facebook-f"><span class="label">Facebook</span></a></li>
// 										<li><a href="#" class="icon brands fa-instagram"><span class="label">Instagram</span></a></li>
// 										<li><a href="#" class="icon brands fa-github"><span class="label">Github</span></a></li>
// 									</ul>
// 									<h4>Actions</h4>
// 									<ul class="actions">
// 										<li><a href="#" class="button primary">Default</a></li>
// 										<li><a href="#" class="button">Default</a></li>
// 									</ul>
// 									<ul class="actions stacked">
// 										<li><a href="#" class="button primary">Default</a></li>
// 										<li><a href="#" class="button">Default</a></li>
// 									</ul>
// 								</section>
// 								<section>
// 									<h3 class="major">Table</h3>
// 									<h4>Default</h4>
// 									<div class="table-wrapper">
// 										<table>
// 											<thead>
// 												<tr>
// 													<th>Name</th>
// 													<th>Description</th>
// 													<th>Price</th>
// 												</tr>
// 											</thead>
// 											<tbody>
// 												<tr>
// 													<td>Item One</td>
// 													<td>Ante turpis integer aliquet porttitor.</td>
// 													<td>29.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Two</td>
// 													<td>Vis ac commodo adipiscing arcu aliquet.</td>
// 													<td>19.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Three</td>
// 													<td> Morbi faucibus arcu accumsan lorem.</td>
// 													<td>29.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Four</td>
// 													<td>Vitae integer tempus condimentum.</td>
// 													<td>19.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Five</td>
// 													<td>Ante turpis integer aliquet porttitor.</td>
// 													<td>29.99</td>
// 												</tr>
// 											</tbody>
// 											<tfoot>
// 												<tr>
// 													<td colspan="2"></td>
// 													<td>100.00</td>
// 												</tr>
// 											</tfoot>
// 										</table>
// 									</div>
// 									<h4>Alternate</h4>
// 									<div class="table-wrapper">
// 										<table class="alt">
// 											<thead>
// 												<tr>
// 													<th>Name</th>
// 													<th>Description</th>
// 													<th>Price</th>
// 												</tr>
// 											</thead>
// 											<tbody>
// 												<tr>
// 													<td>Item One</td>
// 													<td>Ante turpis integer aliquet porttitor.</td>
// 													<td>29.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Two</td>
// 													<td>Vis ac commodo adipiscing arcu aliquet.</td>
// 													<td>19.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Three</td>
// 													<td> Morbi faucibus arcu accumsan lorem.</td>
// 													<td>29.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Four</td>
// 													<td>Vitae integer tempus condimentum.</td>
// 													<td>19.99</td>
// 												</tr>
// 												<tr>
// 													<td>Item Five</td>
// 													<td>Ante turpis integer aliquet porttitor.</td>
// 													<td>29.99</td>
// 												</tr>
// 											</tbody>
// 											<tfoot>
// 												<tr>
// 													<td colspan="2"></td>
// 													<td>100.00</td>
// 												</tr>
// 											</tfoot>
// 										</table>
// 									</div>
// 								</section>
// 								<section>
// 									<h3 class="major">Buttons</h3>
// 									<ul class="actions">
// 										<li><a href="#" class="button primary">Primary</a></li>
// 										<li><a href="#" class="button">Default</a></li>
// 									</ul>
// 									<ul class="actions">
// 										<li><a href="#" class="button">Default</a></li>
// 										<li><a href="#" class="button small">Small</a></li>
// 									</ul>
// 									<ul class="actions">
// 										<li><a href="#" class="button primary icon solid fa-download">Icon</a></li>
// 										<li><a href="#" class="button icon solid fa-download">Icon</a></li>
// 									</ul>
// 									<ul class="actions">
// 										<li><span class="button primary disabled">Disabled</span></li>
// 										<li><span class="button disabled">Disabled</span></li>
// 									</ul>
// 								</section>
// 								<section>
// 									<h3 class="major">Form</h3>
// 									<form method="post" action="#">
// 										<div class="fields">
// 											<div class="field half">
// 												<label for="demo-name">Name</label>
// 												<input type="text" name="demo-name" id="demo-name" value="" placeholder="Jane Doe" />
// 											</div>
// 											<div class="field half">
// 												<label for="demo-email">Email</label>
// 												<input type="email" name="demo-email" id="demo-email" value="" placeholder="jane@untitled.tld" />
// 											</div>
// 											<div class="field">
// 												<label for="demo-category">Category</label>
// 												<select name="demo-category" id="demo-category">
// 													<option value="">-</option>
// 													<option value="1">Manufacturing</option>
// 													<option value="1">Shipping</option>
// 													<option value="1">Administration</option>
// 													<option value="1">Human Resources</option>
// 												</select>
// 											</div>
// 											<div class="field half">
// 												<input type="radio" id="demo-priority-low" name="demo-priority" checked>
// 												<label for="demo-priority-low">Low</label>
// 											</div>
// 											<div class="field half">
// 												<input type="radio" id="demo-priority-high" name="demo-priority">
// 												<label for="demo-priority-high">High</label>
// 											</div>
// 											<div class="field half">
// 												<input type="checkbox" id="demo-copy" name="demo-copy">
// 												<label for="demo-copy">Email me a copy</label>
// 											</div>
// 											<div class="field half">
// 												<input type="checkbox" id="demo-human" name="demo-human" checked>
// 												<label for="demo-human">Not a robot</label>
// 											</div>
// 											<div class="field">
// 												<label for="demo-message">Message</label>
// 												<textarea name="demo-message" id="demo-message" placeholder="Enter your message" rows="6"></textarea>
// 											</div>
// 										</div>
// 										<ul class="actions">
// 											<li><input type="submit" value="Send Message" class="primary" /></li>
// 											<li><input type="reset" value="Reset" /></li>
// 										</ul>
// 									</form>
// 								</section>
// 							</article>
// 					</div><footer id="footer"><p class="copyright">&copy; Carpinito Capital</p></footer>
// 			</div>
// 			<div id="bg"></div>
// 			<script src="assets/js/jquery.min.js"></script>
// 			<script src="assets/js/browser.min.js"></script>
// 			<script src="assets/js/breakpoints.min.js"></script>
// 			<script src="assets/js/util.js"></script>
// 			<script src="assets/js/main.js"></script>
// 	</body>
// </html>