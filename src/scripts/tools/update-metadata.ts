import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity, irysStorage, Nft, Sft } from "@metaplex-foundation/js";
import secret from './priv.json';

const QUICKNODE_RPC = '';
const SOLANA_CONNECTION = new Connection(QUICKNODE_RPC);
const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));
const METAPLEX = Metaplex.make(SOLANA_CONNECTION).use(keypairIdentity(WALLET))
    .use(irysStorage({address: 'https://devnet.bundlr.network', providerUrl: QUICKNODE_RPC, timeout: 60000,}));
const MINT_ADDRESS = 'YOUR_NFT_MINT_ADDRESS'; // 👈 CHANGE THIS (MAKE SURE NFT IS MUTABLE)

const NEW_METADATA = {imgType: 'image/png', imgName: 'QuickPix New MetaName', description: 'New description!',
    attributes: [
        {trait_type: 'Speed', value: 'Quicker'},
        {trait_type: 'Type', value: 'Pixelated'},
        {trait_type: 'Background', value: 'QuickNode Blue 2'}
    ]
};
    
async function uploadMetadata(imgUri: string, imgType: string, nftName: string, description: string, attributes: {trait_type: string, value: string}[]) {
    console.log(`Step 2 - Uploading New MetaData`);
    const { uri } = await METAPLEX.nfts().uploadMetadata({ name: nftName, description: description, image: imgUri, attributes: attributes,properties: {files: [{type: imgType, uri: imgUri}]}});
    console.log('Metadata URI:',uri);
    return uri;    
}

async function updateNft(nft:Nft|Sft, metadataUri: string, newName: string) {
    console.log(`Step 3 - Updating NFT`);
    await METAPLEX.nfts().update({ name: newName, nftOrSft: nft, uri: metadataUri}, { commitment: 'finalized' });
    console.log(`Success!🎉`);
    console.log(`Updated NFT: https://explorer.solana.com/address/${nft.address}`);
}

async function main() {
    console.log(`Updating Metadata of NFT: ${MINT_ADDRESS}}`);
    console.log(`Step 1 - Fetching existing NFT`);
    const nft = await METAPLEX.nfts().findByMint({ mintAddress: new PublicKey(MINT_ADDRESS) });
    if (!nft || !nft.json?.image) {throw new Error("Unable to find existing nft or image uri!")}
    console.log(`   NFT Found!`);
    const newUri = await uploadMetadata(nft.json.image,NEW_METADATA.imgType,NEW_METADATA.imgName, NEW_METADATA.description, NEW_METADATA.attributes); 
    updateNft(nft, newUri, NEW_METADATA.imgName);
}

main();