import { Cluster, Keypair, Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import fetch from "isomorphic-fetch";
import JSBI from "jsbi";
import { getPlatformFeeAccounts, Jupiter, TOKEN_LIST_URL } from "@jup-ag/core";
import Decimal from "decimal.js";
require("dotenv").config();

const ENV = process.env.CLUSTER || "mainnet-beta";
const SOLANA_RPC_ENDPOINT = "<Helius Endpoint>";
const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY || "<Phantom Priv Key>";
const USER_PRIVATE_KEY = bs58.decode(WALLET_PRIVATE_KEY);
const USER_KEYPAIR = Keypair.fromSecretKey(USER_PRIVATE_KEY);

const depinIndexTokens = [
  { ticker: "RENDER", address: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof" },
  { ticker: "HNT", address: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux" },
  { ticker: "MOBILE", address: "mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6" },
  { ticker: "IOT", address: "iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns" },
  { ticker: "SHDW", address: "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y" },
  { ticker: "NOS", address: "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7" },
  { ticker: "HONEY", address: "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy" },
  { ticker: "MEDIA", address: "ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs" },
];

let inputTokenAddress = "";
let outputTokenAddress = "";
let inputAmount = 0;

const getPossiblePairsTokenInfo = ({ tokens, routeMap, inputToken }) => {
  try {
    if (!inputToken) {
      return {};
    }
    const possiblePairs = inputToken ? routeMap.get(inputToken.address) || [] : [];
    const possiblePairsTokenInfo = {};
    possiblePairs.forEach((address) => {
      possiblePairsTokenInfo[address] = tokens.find((t) => t.address == address);
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
      amount: JSBI.BigInt(inputAmountInSmallestUnits),
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
    const { execute } = await jupiter.exchange({ routeInfo });
    const swapResult = await execute();
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
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    const tokens = await (await fetch(TOKEN_LIST_URL[ENV])).json();
    const platformFeeAndAccounts = {
      feeBps: 50,
      feeAccounts: await getPlatformFeeAccounts(connection, new PublicKey("BUX7s2ef2htTGb2KKoPHWkmzxPj4nTWMWRgs5CSbQxf9")),
    };
    const jupiter = await Jupiter.load({ connection, cluster: ENV, user: USER_KEYPAIR, platformFeeAndAccounts });
    const routeMap = jupiter.getRouteMap();
    const inputToken = tokens.find((t) => t.address == inputTokenAddress);
    const outputToken = tokens.find((t) => t.address == outputTokenAddress);
    const routes = await getRoutes({ jupiter, inputToken, outputToken, inputAmount, slippageBps: 100 });
    await executeSwap({ jupiter, routeInfo: routes.routesInfos[0] });
  } catch (error) {
    console.log({ error });
  }
};

const findTrades = async () => {
  const fetchJupiterPriceData = async () => {
    const url = `https://price.jup.ag/v4/price?ids=${outputTokenAddress}&vsToken=${inputTokenAddress}`;
    const jupiterResponse = await fetch(url);
    return jupiterResponse.json();
  };
  const checkQuoteChange = async () => {
    const jupiterRawPriceData = await fetchJupiterPriceData();
    const jupiterPriceData = jupiterRawPriceData.data['rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof'];
    const jupiterQuote = jupiterPriceData.price;
    const mintTicker = jupiterPriceData.mintSymbol;
    const vsTicker = jupiterPriceData.vsTokenSymbol;
    console.log("Jupiter: 1 " + mintTicker + " = " + jupiterQuote + " " + vsTicker);
    console.log("                                                              ");
    console.log("--------------------------------------------------------------");
    console.log("                                                              ");
  };
  setInterval(checkQuoteChange, 0.5 * 60 * 1000);
};

export { main, findTrades };