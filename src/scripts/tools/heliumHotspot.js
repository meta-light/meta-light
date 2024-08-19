import fetch from 'node-fetch';

export async function callApi(apiUrl) {
  const apiKey = ''; //API KEY GOES HERE
  try {
    const response = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

export async function handleWalletInput(walletInput, userChoice, hotspotAddress = '') {
  let apiUrl = '';
  switch (userChoice) {
    case '1':
      apiUrl = `https://beta-api.hotspotty.net/api/v1/wallets/${walletInput}/hotspots`;
      break;
    case '2':
      apiUrl = `https://beta-api.hotspotty.net/api/v1/hotspots/${hotspotAddress}/rewards`;
      break;
    case '3':
      apiUrl = `https://beta-api.hotspotty.net/api/v1/hotspots/${hotspotAddress}/speedtests`;
      break;
    case '4':
      apiUrl = `https://beta-api.hotspotty.net/api/v1/hotspots/${hotspotAddress}/cells`;
      break;
    default:
      throw new Error('Invalid choice');
  }
  return await callApi(apiUrl);
}