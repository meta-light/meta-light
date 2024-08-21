import React, { useState } from 'react';

export default function SnapshotTool() {
  const [groupValue, setGroupValue] = useState('');
  const handleSubmit = () => {getAssetsByGroup(groupValue);};
  const handleInputChange = (event) => {setGroupValue(event.target.value);};
  const heliusKey = process.env.HELIUS_KEY;
  const getAssetsByGroup = async (groupValue) => {
    const url = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    let page = 1;
    let assetList = [];
    while (page) {
      const response = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ jsonrpc: "2.0", id: "my-id", method: "getAssetsByGroup", params: { groupKey: "collection", groupValue: groupValue, page: page, limit: 1000 }})});
      const { result = {} } = await response.json();
      if (result.items && result.items.length > 0) {assetList.push(...result.items);}
      if (result.total !== 1000) {page = false;} else {page++;}
    }
    const rawList = assetList.map(item => item.ownership.owner);
    let uniqueOwners = [];
    rawList.forEach(owner => {if (!uniqueOwners.includes(owner)) {uniqueOwners.push(owner);}});
    try {
      const response = await fetch('/api/processDuplicates', {method: 'POST', headers: {'Content-Type': 'application/json',}, body: JSON.stringify({ data: uniqueOwners })});
      const result = await response.json();
      if (response.ok) {console.log(result.message); const a = document.createElement('a'); a.href = result.path; a.download = 'uniqueOwners.json'; a.click();} else {console.error('Error:', result.error);}
    } 
    catch (error) {console.error('Error calling API:', error);}
  };

  return (
    <div>
      <input type="text" value={groupValue} onChange={handleInputChange} placeholder="Enter Collection Address" className="rounded-lg border border-gray-300 px-3 py-2 font-mono" style={{ width: '200%', color: 'black' }}/>
      <button onClick={handleSubmit} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded font-mono">Submit</button>
    </div>
  );
}