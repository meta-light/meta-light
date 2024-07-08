const web3 = require("@solana/web3.js");
const bs58 = require('bs58');
const fs = require('fs');

function processSolanaKey(privateKeyBase58, privateKeyArray) {
    let secretKey = bs58.decode(privateKeyBase58);
    console.log("Hex:", `[${web3.Keypair.fromSecretKey(secretKey).secretKey}]`);

    let privkey = new Uint8Array(privateKeyArray);
    console.log("Base 58:", bs58.encode(privkey));

    const length = privkey.length;
    const halfLength = Math.ceil(length / 2);

    const firstHalf = privkey.subarray(0, halfLength);
    const secondHalf = privkey.subarray(halfLength);

    console.log("First Half:", firstHalf);
    console.log("Second Half:", secondHalf);

    let j = new Uint8Array(secretKey.buffer, secretKey.byteOffset, secretKey.byteLength / Uint8Array.BYTES_PER_ELEMENT);
    fs.writeFileSync('key.json', `[${j}]`);
    console.log("JSON:", `[${j}]`);
}

module.exports = { processSolanaKey };