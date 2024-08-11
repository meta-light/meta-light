import { Cluster, Keypair, Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import fetch from "isomorphic-fetch";
import JSBI from "jsbi";
import { getPlatformFeeAccounts, Jupiter, RouteInfo, TOKEN_LIST_URL } from "@jup-ag/core";
import Decimal from "decimal.js";
require("dotenv").config();

const ENV = process.env.CLUSTER || "mainnet-beta";
const SOLANA_RPC_ENDPOINT = "API KEY";
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "PHANTOM PRIV KEY";
const USER_PRIVATE_KEY = bs58.decode(WALLET_PRIVATE_KEY);
const USER_KEYPAIR = Keypair.fromSecretKey(USER_PRIVATE_KEY);

const tokenNumberOne = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
const tokenNumberTwo = "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof"; // RENDER
const outputTicker = "RNDR"; // CMC Ticker
const inputAmount = 0.1;

const getPossiblePairsTokenInfo = ({ tokens, routeMap, inputToken }) => {
  try {
    if (!inputToken) {
      return {};
    }
    const possiblePairs = inputToken ? routeMap.get(inputToken.address) || [] : [];
    const possiblePairsTokenInfo = {};
    possiblePairs.forEach((address) => {
      possiblePairsTokenInfo[address] = tokens.find((t) => t.address === address);
    });
    return possiblePairsTokenInfo;
  } catch (error) {
    throw error;
  }
};

const getRoutes = async ({ jupiter, inputToken, outputToken, inputAmount, slippageBps }) => {
  try {
    if (!inputToken || !outputToken) {
      return null;
    }
    console.log(`Getting routes for ${inputAmount} ${inputToken.symbol} -> ${outputToken.symbol}...`);
    const inputAmountInSmallestUnits = inputToken ? Math.round(inputAmount * 10 ** inputToken.decimals) : 0;
    const routes = inputToken && outputToken ? await jupiter.computeRoutes({
      inputMint: new PublicKey(inputToken.address),
      outputMint: new PublicKey(outputToken.address),
      amount: JSBI.BigInt(inputAmountInSmallestUnits), // raw input amount of tokens
      slippageBps,
      forceFetch: true,
    }) : null;

    if (routes && routes.routesInfos) {
      console.log("Possible number of routes:", routes.routesInfos.length);
      console.log("Best quote: ", new Decimal(routes.routesInfos[0].outAmount.toString())
        .div(10 ** outputToken.decimals)
        .toString(),
        `(${outputToken.symbol})`
      );
      return routes;
    } else {
      return null;
    }
  } catch (error) {
    throw error;
  }
};

const executeSwap = async ({ jupiter, routeInfo }) => {
  try {
    const { execute } = await jupiter.exchange({ routeInfo }); // Prepare execute exchange
    const swapResult = await execute(); // Force any to ignore TS misidentifying SwapResult type
    if (swapResult.error) {
      console.log(swapResult.error);
    } else {
      console.log(`https://explorer.solana.com/tx/${swapResult.txid}`);
      console.log(`inputAddress=${swapResult.inputAddress.toString()} outputAddress=${swapResult.outputAddress.toString()}`);
      console.log(`inputAmount=${swapResult.inputAmount} outputAmount=${swapResult.outputAmount}`);
    }
  } catch (error) {
    throw error;
  }
};

const main = async () => {
  try {
    const connection = new Connection(SOLANA_RPC_ENDPOINT); // Setup Solana RPC connection
    const tokens = await (await fetch(TOKEN_LIST_URL[ENV])).json(); // Fetch token list from Jupiter API
    const platformFeeAndAccounts = {
      feeBps: 50,
      feeAccounts: await getPlatformFeeAccounts(connection, new PublicKey("BUX7s2ef2htTGb2KKoPHWkmzxPj4nTWMWRgs5CSbQxf9")),
    };
    const jupiter = await Jupiter.load({ connection, cluster: ENV, user: USER_KEYPAIR, platformFeeAndAccounts });
    const routeMap = jupiter.getRouteMap(); // Get routeMap, which maps each tokenMint and their respective tokenMints that are swappable
    const inputToken = tokens.find((t) => t.address === tokenNumberOne); // USDC Mint Info
    const outputToken = tokens.find((t) => t.address === tokenNumberTwo); // RNDR Mint Info
    const possiblePairsTokenInfo = await getPossiblePairsTokenInfo({ tokens, routeMap, inputToken }); // Alternatively, find all possible outputToken based on your inputToken
    const routes = await getRoutes({ jupiter, inputToken, outputToken, inputAmount, slippageBps: 100 }); // .01 unit in UI 1% slippage
    await executeSwap({ jupiter, routeInfo: routes.routesInfos[0] });
  } catch (error) {
    console.log({ error });
  }
};

const findTrades = async () => {
  const fetchJupiterPriceData = async () => {
    const url = `https://price.jup.ag/v4/price?ids=${tokenNumberTwo}&vsToken=${tokenNumberOne}`;
    const jupiterResponse = await fetch(url);
    return jupiterResponse.json();
  };

  const fetchCMCPriceData = async () => {
    const url = `https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?CMC_PRO_API_KEY=78e0edc5-47ad-4c3a-9b17-f4fb79f8a8d3&symbol=${outputTicker}`;
    const CMCresponse = await fetch(url);
    return CMCresponse.json();
  };

  const checkQuoteChange = async () => {
    const jupiterRawPriceData = await fetchJupiterPriceData();
    const jupiterPriceData = jupiterRawPriceData.data['rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof'];
    const jupiterQuote = jupiterPriceData.price;
    const mintTicker = jupiterPriceData.mintSymbol;
    const vsTicker = jupiterPriceData.vsTokenSymbol;
    console.log("Jupiter: 1 " + mintTicker + " = " + jupiterQuote + " " + vsTicker);
    const CMCRawPriceData = await fetchCMCPriceData();
    const CMCQuote = CMCRawPriceData.data.RNDR[0].quote.USD.price;
    console.log("CoinMarketCap: 1 " + outputTicker + " = " + CMCQuote + " " + vsTicker);
    if (jupiterQuote < CMCQuote) {
      await main();
      console.log("Swapped " + inputAmount + " " + vsTicker + " for " + mintTicker);
    } else {
      console.log("No Action Taken");
    }
    console.log("                                                              ");
    console.log("--------------------------------------------------------------");
    console.log("                                                              ");
  };

  setInterval(checkQuoteChange, 0.5 * 60 * 1000); // Check quote change every .5 min
};

findTrades();