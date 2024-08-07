export const getBalances = async (address, apiKey) => {
  const url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log("balances: ", data);
  console.log((data.nativeBalance / 1000000000));
  return data;
};