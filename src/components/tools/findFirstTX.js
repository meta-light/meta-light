export const parseTransactions = async (address, apiKey) => {
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  const slots = data.map(entry => entry.slot);
  slots.sort((a, b) => a - b);
  const lowestslot = slots[0];
  const lowestslotEntry = data.find(entry => entry.slot === lowestslot);
  console.log(slots);
  console.log(lowestslot);
  console.log(lowestslotEntry);
  return { slots, lowestslot, lowestslotEntry };
};