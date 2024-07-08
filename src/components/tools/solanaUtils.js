const web3 = require('@solana/web3.js');
const { Helius } = require('helius-sdk');
const HeliusKey = new Helius("<API KEY>");
const ownerAddress = "9cpGSYpRthttGo3QvidzWbd3nseHP3fGSURQvqsih7dw";

let assetInfoList = [];

async function getTPS() {
  const tps = await HeliusKey.rpc.getCurrentTPS();
  console.log("Solana TPS:", tps);
}

async function searchAssets() {
    const response = await HeliusKey.rpc.searchAssets({ ownerAddress: ownerAddress, compressed: true, page: 1 });
    const ids = response.items.map(item => item.id);
    for (const id of ids) {
      const info = await getAssetInfo(id);
      if (info.state) { assetInfoList.push(info); }
    }
    console.log(assetInfoList);
    //console.table(assetInfoList);
    //displayImages();
}

async function getAssetInfo(id) {
    const response = await HeliusKey.rpc.getAsset(id);
    //console.log(response);
    const name = response.content.metadata.name;
    const state = response.compression.compressed;
    const image = response.content.links.image;
    const assetId = response.id;
    return { name, assetId, state, image };
}

async function displayImages() {
    const imageGrid = document.querySelector(".image-grid");
    for (const assetInfo of assetInfoList) {
        const imgElement = document.createElement("img");
        imgElement.src = assetInfo.image;
        imgElement.alt = assetInfo.name;
        imageGrid.appendChild(imgElement);
    }
}

module.exports = {
  getTPS,
  searchAssets,
  getAssetInfo,
  displayImages
};