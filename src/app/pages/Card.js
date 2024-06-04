import Image from "next/image";
import styles from "./page.module.css";
import Head from 'next/head';
import './styles/styles.css'

export default function Home() {
  return (
    <Head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Nick Carpinito - Business Card</title>
        <meta name="description" content="Mint my business card" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,500;1,400&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.lineicons.com/2.0/LineIcons.css">
        <link rel="stylesheet" href="styles/styles.css">
        <link rel="stylesheet" href="https://unpkg.com/terminal.css@0.7.2/dist/terminal.min.css" />
        <link rel="icon" type="image/x-icon" href="https://www.arweave.net/VAcRFW7lB18WknaQOGScvFGB2C6jH4khS7VKnMXYiNo?ext=jpg" />
    </Head>
<body>
    <div class="outerWrapper">
        <div class="innerWrapper">
            <section class="worksSection" id="works">
                <br>
                <br>
                <div class="sectionHead">
                    <span>MINT</span>
                    <h2>MY BUSINESS CARD</h2>
                </div>
                <div class="worksContainer sectionContainer">
                    <article class="workBox">
                        <div class="workImageContainer">
                            <img src="https://updg8.com/imgdata/7FrYX7zcRUtGcyumpbFH8QkbaDpSb8Td1mtEF5eAFzsv"
                                alt="Business Card">
                        </div>
                        <div class="workDescribeContainer">
                            <label for="text">Enter your Solana Address</label>
                            <input id="address" name="text" type="text" required="" minlength="30" placeholder="Solana Address">
                            <br><br>
                            <a class="mintButton" onclick="MINT()" alt="MINT" target="_blank" rel="noopener noreferrer">MINT</a>
                            <br><br>
                            <div id="success-message" style="display: none; color: green;"></div>
                            <div id="error-message" style="display: none; color: red;"></div>
                        </div>
                    </article>
                </div>
            </section>
        </div>
    </div>
    <script>
function MINT() {
    var inputVal = document.getElementById("address").value;
    const successMessage = document.getElementById("success-message");
    const errorMessage = document.getElementById("error-message");

    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authorization: 'Bearer 0553457e4e8222.c7f174e6bb924a8da383eb4d3ea89641'
        },
        body: JSON.stringify({
            receiverAddress: inputVal,
            name: 'Nick Carpinito Business Card',
            symbol: 'NICK',
            description: 'X: https://twitter.com/0xMetaLight Github: https://github.com/meta-lite',
            image: 'https://updg8.com/imgdata/7FrYX7zcRUtGcyumpbFH8QkbaDpSb8Td1mtEF5eAFzsv',
            externalUrl: 'https://meta-light.vercel.app/'
        })
    };

    fetch('https://api.underdogprotocol.com/v2/projects/2/nfts', options)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            if (data.projectId === 2) {
                successMessage.textContent = "Business Card minted to " + inputVal;
                successMessage.style.display = "block";
                errorMessage.style.display = "none";
            } else {
                errorMessage.textContent = "Error minting Business Card";
                errorMessage.style.display = "block";
                successMessage.style.display = "none";
            }
        })
        .catch(err => {
            errorMessage.textContent = "Error: " + err.message;
            errorMessage.style.display = "block";
            successMessage.style.display = "none";
        });
}

    </script>
</body>
</html>
  );
}
