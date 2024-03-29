const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const { Market } = require('@project-serum/serum');
const { TokenInstructions } = require('@project-serum/serum');
const { TokenSwap } = require('@solana/spl-token-swap');
const { Token } = require('@solana/spl-token');
const { BufferLayout } = require('@solana/buffer-layout');

const solanaNodeUrl = 'https://api.mainnet-beta.solana.com';
const wallet = Keypair.fromSecretKey(Buffer.from("Key Goes Here"))

const tokenAAddressStr = 'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns';
const tokenAAddress = new PublicKey(tokenAAddressStr);

const tokenBAddressStr = 'AmgUMQeqW8H74trc8UkKjzZWtxBdpS496wh4GLy2mCpo';
const tokenBAddress = new PublicKey(tokenBAddressStr);

const tokenSwapAddressStr = 'J5U6amNaxzBtXbbgL8c6QsX6x9SMteqYhZgnddxiJ9Lb';
const tokenSwapAddress = new PublicKey(tokenSwapAddressStr);

async function swapTokens() {
  const connection = new Connection(solanaNodeUrl, 'confirmed');

  try {
    // Fetch Token Swap Market
    const tokenSwapMarket = await TokenSwap.loadTokenSwap(connection, tokenSwapAddress, {}, null);

    // Fetch Token Accounts
    const tokenA = new Token(connection, tokenAAddress, null, wallet);
    const tokenB = new Token(connection, tokenBAddress, null, wallet);

    // Amount of token A to swap
    const amountToSwap = 10; // Example: Swap 10 token A for token B

    // Get the swap result
    const swapResult = await tokenSwapMarket.swap(
      tokenA,
      tokenB,
      wallet.publicKey,
      null, // Swap fee payer, null for the wallet
      amountToSwap,
      0, // Minimum amount of token B to receive (optional)
    );

    // Transfer swapped tokens to an external address
    const externalAddressStr = '2wzBg2xGMNR1Nr6cGywo3LJCXhMSntRxuwg15SCP3vL3'; // External address where you want to send the swapped tokens
    const externalAddress = new PublicKey(externalAddressStr);
    const transaction = await tokenB.transfer(
      swapResult,
      wallet.publicKey,
      externalAddress,
      [], // Memo
    );

    // Sign and send the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.partialSign(wallet);
    await connection.sendRawTransaction(transaction.serialize());
    console.log('Swap completed and tokens sent to the external address.');
  } catch (error) {
    console.error('Error:', error);
  }

  try {
    const privateKeyBytes = Buffer.from(privateKeyArray, 'hex');
    const wallet = Keypair.fromSecretKey(privateKeyBytes);
    console.log(wallet);
    const walletPublicKey = wallet.publicKey;

    const tokenA = await connection.getTokenAccountBalance(tokenAAddress);
    const tokenB = await connection.getTokenAccountBalance(tokenBAddress);
    const dexMarket = await Market.load(connection, dexMarketAddress, {}, TokenInstructions);

    // Check tokenA and tokenB balances, make sure there are enough tokens for the swap
    await performSwap(connection, wallet, dexMarket, tokenA, tokenB, 10); // Example: Swap 10 token A for token B
  } catch (error) {
    console.error('Error:', error);
  }
}

async function performSwap(connection, wallet, dexMarket, tokenA, tokenB, amount);
swapTokens();