# cnft-basket
A way to create "baskets" of compressed NFT's for ease of trade, transfer and storage. 

## Abstract
In a tweet [here](https://twitter.com/0xMetaLight/status/1688198505599246337?s=20) I outlined my thoughts on what I see as beneficial tooling for the rapidly expanding compressed NFT ecosystem on Solana. cNFT's revolutionized the collectibles ecosystem on Solana, making NFT mints exponsionally less expensive and allowing for significantly higher collection sizes. While this helped Solana make waves in NFT markets and user onboarding, marketplaces have been flooded with millions of cNFT's, driving prices to a point where, in most collections, a floor price compressed NFT is less than the gas required to purchase it from the marketplace. 

To address this issue, cNFT Basket creates a pNFT, sends an input of 10-1000 cNFT's to the pNFT, and gives ownership of the "Basket" to the pNFT creator, allowing NFT traders to easily trade batches of thier favorite cNFT collections. 

## Examples
- 10 Tensorian Shards (Amount needed to mint 1 Tensorian)
- 100 Dialect Stickers (floor priced stickers from the same pack)
- 1000 Drip Haus S2 commons (cost effective trading) 


## Getting Started
First, run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.