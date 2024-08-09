const fs = require('fs');
const url = ``

const getAssetsByGroup = async () => {
  console.time("getAssetsByGroup");
  let page = 1;
  let assetList = [];

  while (page) {
    const response = await fetch(url, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetsByGroup",
        params: {
          groupKey: "collection",
          groupValue: "5Q7NiBGX3ifu7rSjj4FECn5TwbdEY1hpDFLuo5mC5tVU",
          page: page,
          limit: 1000,
        },
      }),
    });
    const { result = [] } = await response.json();
    assetList.push(...result.items);
    if (result.total !== 1000) {page = false; } else {page++;}
  }
  const rawList = assetList.map(item => item.ownership.owner);
  const uniqueOwners = [];
  rawList.forEach(owner => {if (!uniqueOwners.includes(owner)) {uniqueOwners.push(owner);}});
  console.log(uniqueOwners)
  fs.writeFileSync('items.json', JSON.stringify(uniqueOwners));
  console.log(uniqueOwners.length);
};
getAssetsByGroup();

    



