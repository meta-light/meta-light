import { useState, useEffect } from 'react';
import Head from 'next/head';
import '../app/styles/styles.css'
import '../app/styles/LineIcons.css'
import '../app/globals.css'
import 'terminal.css'

export default function Card() {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        fetch('/api/getApiKey')
            .then(response => response.json())
            .then(data => setApiKey(data.apiKey))
            .catch(error => console.error('Error fetching API key:', error));
    }, []);

    function MINT() {
        var inputVal = document.getElementById("address").value;
        const successMessage = document.getElementById("success-message");
        const errorMessage = document.getElementById("error-message");
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                receiverAddress: inputVal,
                name: 'Nick Carpinito Business Card',
                symbol: 'NICK',
                description: 'X: https://twitter.com/0xMetaLight Github: https://github.com/meta-light',
                image: 'https://updg8.storage.googleapis.com/bb6550c4-7919-4ce8-bdf6-e5894557dfa6',
                externalUrl: 'https://carpinito.id/'
            })
        };
    
        fetch('https://api.underdogprotocol.com/v2/projects/4/nfts', options)
            .then(response => response.json())
            .then(data => {
                console.log('API Response:', data); // Log the response to the console
                if (data.projectId === 4) {
                    successMessage.textContent = "Business Card minted to " + inputVal;
                    successMessage.style.display = "block";
                    errorMessage.style.display = "none";
                } else {
                    errorMessage.textContent = "Error minting Business Card";
                    errorMessage.style.display = "block";
                    successMessage.style.display = "none";
                }
            }).catch(err => {
                console.error('Error:', err); // Log any errors to the console
                errorMessage.textContent = "Error: " + err.message;
                errorMessage.style.display = "block";
                successMessage.style.display = "none";
            });
    }
  return (
    <>
        <Head>
            <title>Nick Carpinito - Business Card</title>
            <meta name="description" content="Mint my business card" />
        </Head>
        <div className="outerWrapper h-screen flex justify-center items-center">
            <div className="innerWrapper">
                <section className="worksSection" id="works">
                    <div className="sectionHead"><span>MINT</span><h2>MY BUSINESS CARD</h2></div>
                    <div className="worksContainer sectionContainer">
                        <article className="workBox">
                            <div className="workImageContainer"><img src="https://updg8.storage.googleapis.com/bb6550c4-7919-4ce8-bdf6-e5894557dfa6" alt="Business Card"/></div>
                            <div className="workDescribeContainer">
                                <label htmlFor="text" className="mb-2">Enter your Solana Address</label>
                                <input id="address" name="text" type="text" required="" minLength="30" placeholder="Solana Address" className="text-black"/>
                                <div id="success-message" className="text-green-500"></div>
                                <div id="error-message" className="text-red-500"></div>
                                <button className="btn btn-primary btn-block mt-4" onClick={MINT}>MINT</button>
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        </div>
    </>
  );
}