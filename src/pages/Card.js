import Head from 'next/head';
import '../app/styles/styles.css'
import '../app/styles/LineIcons.css'

export default function Card() {
    const UNDERDOG_API_KEY = process.env.UNDERDOG_API_KEY;
    console.log(UNDERDOG_API_KEY);


    function MINT() {
        var inputVal = document.getElementById("address").value;
        const successMessage = document.getElementById("success-message");
        const errorMessage = document.getElementById("error-message");
        const options = {
            method: 'POST', headers: {accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + UNDERDOG_API_KEY},
            body: JSON.stringify({
                receiverAddress: inputVal, name: 'Nick Carpinito Business Card',
                symbol: 'NICK', description: 'X: https://twitter.com/0xMetaLight Github: https://github.com/meta-light',
                image: 'https://updg8.com/imgdata/7FrYX7zcRUtGcyumpbFH8QkbaDpSb8Td1mtEF5eAFzsv', externalUrl: 'https://carpinito.id/'
            })
        };
    
        fetch('https://api.underdogprotocol.com/v2/projects/2/nfts', options).then(response => response.json())
            .then(data => {
                if (data.projectId === 2) {successMessage.textContent = "Business Card minted to " + inputVal; successMessage.style.display = "block"; errorMessage.style.display = "none";} 
                else {errorMessage.textContent = "Error minting Business Card"; errorMessage.style.display = "block"; successMessage.style.display = "none";}
            }).catch(err => {errorMessage.textContent = "Error: " + err.message; errorMessage.style.display = "block"; successMessage.style.display = "none";});
    }
  return (
    <>
        <Head>
            <title>Nick Carpinito - Business Card</title>
            <meta name="description" content="Mint my business card" />
            <link rel="stylesheet" href="https://unpkg.com/terminal.css@0.7.2/dist/terminal.min.css" />
            {/* Need to download terminal.css as NPM */}
        </Head>
        <div className="outerWrapper">
            <div className="innerWrapper">
                <section className="worksSection" id="works">
                    <div className="sectionHead"><span>MINT</span><h2>MY BUSINESS CARD</h2></div>
                    <div className="worksContainer sectionContainer">
                        <article className="workBox">
                            <div className="workImageContainer"><img src="https://updg8.com/imgdata/7FrYX7zcRUtGcyumpbFH8QkbaDpSb8Td1mtEF5eAFzsv" alt="Business Card"/></div>
                            <div className="workDescribeContainer">
                                <label htmlFor="text">Enter your Solana Address</label>
                                <input id="address" name="text" type="text" required="" minLength="30" placeholder="Solana Address"/>
                                <a className="mintButton" onClick={MINT} alt="MINT" target="_blank" rel="noopener noreferrer">MINT</a>
                                {/* <div id="success-message" style={{display: none, color: green}}></div>
                                <div id="error-message" style={{display: none, color: red}}></div> */}
                                {/* need to fix above styling, prob with css sheet of its own */}
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        </div>
    </>
  );
}