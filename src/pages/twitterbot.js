import { useState } from 'react';
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey: process.env.API_KEY,
  appSecret: process.env.API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

const bearer = new TwitterApi(process.env.BEARER_TOKEN);

const twitterClient = client.readWrite;
const twitterBearer = bearer.readOnly;

const Home = () => {
  const [mobilePriceUSD, setMobilePriceUSD] = useState('');
  const [dimoPriceUSD, setDimoPriceUSD] = useState('');

  const getMobilePrice = async () => {
    const url = `https://price.jup.ag/v4/price?ids=mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6&vsToken=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`;
    const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' }});
    const data = await response.json();
    const MOBILEprice = data.data.mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6.price;
    setMobilePriceUSD(MOBILEprice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
    console.log('MOBILE Price:', MOBILEprice);
  };

  const getDimoPrice = async () => {
    const url = 'https://api.portals.fi/v2/tokens?search=DIMO&sortDirection=asc&limit=25&page=0';
    const response = await fetch(url, { method: 'GET',  headers: { 'accept': 'application/json', 'Authorization': 'Bearer <bearer>' }});
    const data = await response.json();
    const DIMOprice = data.tokens[1].price;
    setDimoPriceUSD(DIMOprice.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
    console.log('DIMO Price:', data.tokens[1].price);
  };

  const tweet = async () => {
    await getMobilePrice();
    await getDimoPrice();
    console.log(dimoPriceUSD);
    console.log(mobilePriceUSD);
    const currentDate = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    const dateFormatter = new Intl.DateTimeFormat('en-US', options);
    const formattedDate = dateFormatter.format(currentDate);
    const tweetContent = 
    `${formattedDate} DEPIN Retail Hardware Report:

    - A $20/month unlimited @helium_mobile plan earns ~$11.28/day 

    - A $250 @helium_mobile indoor wifi hotspot earns ~$6.24/day `;
    console.log(tweetContent);
  };

  return (
    <div>
      <h1>Twitter Bot</h1>
      <button onClick={tweet}>Initiate Process</button>
    </div>
  );
};

export default Home;