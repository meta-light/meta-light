
export async function getTokenSupply(mint: string): Promise<number> {
    try {
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({'jsonrpc': '2.0', 'id': 'test', 'method': 'getAsset', 'params': {'id': mint}})});
      const data = await response.json();
      if (data && data.result && data.result.token_info) {
        const supply = data.result.token_info.supply;
        const decimals = data.result.token_info.decimals;
        let realSupply = parseFloat(supply);
        if (decimals != null) {realSupply = realSupply / Math.pow(10, Number(decimals));}
        return realSupply;
      }
      return 0;
    } 
    catch (error) {console.error('[helius]: Error fetching token supply:', error); return 0;}
}

export async function getTokenBalance(mint: string, walletAddress: string): Promise<number> {
    try {
      let page = 1;
      const limit = 100;
      let assetFound: any | null = null;
      while (true) {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'jsonrpc': '2.0',
            'id': 'test',
            'method': 'getAssetsByOwner',
            'params': {
              'ownerAddress': walletAddress,
              page,
              limit,
              'before': '',
              'after': '',
              'options': {'showUnverifiedCollections': false, 'showCollectionMetadata': false, 'showGrandTotal': false, 'showFungible': true, 'showNativeBalance': false, 'showInscription': false, 'showZeroBalance': false},
              'sortBy': { 'sortBy': 'created', 'sortDirection': 'asc' }
            }
          })
        });
        const data = await response.json();
        const assets = data.result?.items || [];
        assetFound = assets.find((asset: any) => asset.id && asset.id.toLowerCase() === mint.toLowerCase());
        if (assetFound) {break;}
        if (assets.length < limit) {break;}
        page++;
      }
      if (assetFound) {
        if (assetFound.token_info && assetFound.token_info.balance != null && assetFound.token_info.decimals != null) {
          const rawBalance = parseFloat(assetFound.token_info.balance);
          const decimals = Number(assetFound.token_info.decimals);
          return rawBalance / Math.pow(10, decimals);
        } 
        else if (assetFound.balance) {return parseFloat(assetFound.balance);}
      }
      return 0;
    } 
    catch (error) {console.error('[helius]: Error fetching token balance:', error); return 0;}
}

export const SolanaCoreValidatedTokens = [
    { ticker: 'HNT',      address: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',  decimals: 8, isStablecoin: false, isGasToken: false },
    { ticker: 'MOBILE',   address: 'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6',  decimals: 6, isStablecoin: false, isGasToken: false },
    { ticker: 'IOT',      address: 'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns',  decimals: 6, isStablecoin: false, isGasToken: false }
];

export async function getTokenPrices(mints: string[]): Promise<Record<string, number>> {
    try {
      const response = await fetch(`https://api.jup.ag/price/v3?ids=${mints.join(',')}`);
      const data = await response.json();
      const prices: Record<string, number> = {};
      for (const mint of mints) {
        const usdPrice = data?.[mint]?.usdPrice;
        prices[mint] = usdPrice != null ? Number(usdPrice) : 0;
      }
      return prices;
    }
    catch (error) {console.error('[jupiter]: Error fetching token prices:', error); return {};}
}

export const getHeliumSwapRates = async (prices: any) => {
    const HELIUM_TREASURY_ADDRESSES = {MOBILE: 'AguTdjmW5SkhepT9qsKsj29SEqiVKsJchsap6Kma9i98', IOT: '4UiT93tyCivCHetditvH15wqWxYrHcoPWzQiKDQYF7Uo'};
    const tokens = SolanaCoreValidatedTokens.filter((token: any) => ['HNT', 'MOBILE', 'IOT'].includes(token.ticker));
    if (!tokens || tokens.length < 3) {console.error('Missing token information for HNT, MOBILE, or IOT'); return null;}
    const hntToken = tokens.find((token: any) => token.ticker === 'HNT');
    const mobileToken = tokens.find((token: any) => token.ticker === 'MOBILE');
    const iotToken = tokens.find((token: any) => token.ticker === 'IOT');
    if (!hntToken?.address || !mobileToken?.address || !iotToken?.address) {console.error('Missing token addresses'); return null;}
    if (!prices) {console.error('Failed to fetch token prices from Jupiter'); return null;}
    const HNT_MARKET_PRICE = prices[hntToken.address] || 0;
    const MOBILE_MARKET_PRICE = prices[mobileToken.address] || 0;
    const IOT_MARKET_PRICE = prices[iotToken.address] || 0;
    if (HNT_MARKET_PRICE === 0 || MOBILE_MARKET_PRICE === 0 || IOT_MARKET_PRICE === 0) {console.error('One or more token prices are zero'); return null;}
    const [actualMobileTreasury, actualIotTreasury, mobileSupply, iotSupply] = await Promise.all([
      getTokenBalance(hntToken.address, HELIUM_TREASURY_ADDRESSES.MOBILE),
      getTokenBalance(hntToken.address, HELIUM_TREASURY_ADDRESSES.IOT),
      getTokenSupply(mobileToken.address),
      getTokenSupply(iotToken.address)
    ]);
    if (!actualMobileTreasury || actualMobileTreasury === 0) {console.error('MOBILE treasury balance is zero or invalid:', actualMobileTreasury); return null;}
    if (!actualIotTreasury || actualIotTreasury === 0) {console.error('IOT treasury balance is zero or invalid:', actualIotTreasury); return null;}
    if (!mobileSupply || mobileSupply === 0) {console.error('MOBILE supply is zero or invalid:', mobileSupply); return null;}
    if (!iotSupply || iotSupply === 0) {console.error('IOT supply is zero or invalid:', iotSupply); return null;}
    const marketRates = {
      HNT_MOBILE: HNT_MARKET_PRICE / MOBILE_MARKET_PRICE,
      HNT_IOT: HNT_MARKET_PRICE / IOT_MARKET_PRICE,
      MOBILE_HNT: MOBILE_MARKET_PRICE / HNT_MARKET_PRICE,
      IOT_HNT: IOT_MARKET_PRICE / HNT_MARKET_PRICE
    };
    const treasuryRates = {
      HNT_MOBILE: actualMobileTreasury > 0 ? mobileSupply / actualMobileTreasury : 0,
      HNT_IOT: actualIotTreasury > 0 ? iotSupply / actualIotTreasury : 0,
      MOBILE_HNT: mobileSupply > 0 ? actualMobileTreasury / mobileSupply : 0,
      IOT_HNT: iotSupply > 0 ? actualIotTreasury / iotSupply : 0
    };
    if (!isFinite(treasuryRates.HNT_MOBILE) || !isFinite(treasuryRates.HNT_IOT) || !isFinite(treasuryRates.MOBILE_HNT) || !isFinite(treasuryRates.IOT_HNT)) {
        console.error('Treasury rates contain invalid values (Infinity/NaN):', treasuryRates);
        return null;
    }
    const marketPrices = {HNT: HNT_MARKET_PRICE, MOBILE: MOBILE_MARKET_PRICE, IOT: IOT_MARKET_PRICE};
    const treasuryBalances = {MOBILE: actualMobileTreasury, IOT: actualIotTreasury};
    const supplies = {MOBILE: mobileSupply, IOT: iotSupply};
    const mobile1000 = {SWAPPED_HNT: 1000 * marketRates.MOBILE_HNT, REDEEMED_HNT: 1000 * treasuryRates.MOBILE_HNT};
    const analysis = {
      MOBILE: {
        impliedMarketCapUsd: mobileSupply * MOBILE_MARKET_PRICE,
        redemptionFloorValueUsd: actualMobileTreasury * HNT_MARKET_PRICE,
        premiumAboveFloorUsd: mobileSupply * MOBILE_MARKET_PRICE - actualMobileTreasury * HNT_MARKET_PRICE,
        marketPriceVsFloorMultiple: treasuryRates.MOBILE_HNT > 0 ? marketRates.MOBILE_HNT / treasuryRates.MOBILE_HNT : 0
      },
      IOT: {
        impliedMarketCapUsd: iotSupply * IOT_MARKET_PRICE,
        redemptionFloorValueUsd: actualIotTreasury * HNT_MARKET_PRICE,
        premiumAboveFloorUsd: iotSupply * IOT_MARKET_PRICE - actualIotTreasury * HNT_MARKET_PRICE,
        marketPriceVsFloorMultiple: treasuryRates.IOT_HNT > 0 ? marketRates.IOT_HNT / treasuryRates.IOT_HNT : 0
      }
    };
    return {market: marketRates, treasury: treasuryRates, marketPrices, treasuryBalances, supplies, mobile1000, analysis};
};

const priceMints = SolanaCoreValidatedTokens.map((token) => token.address);

getTokenPrices(priceMints).then(getHeliumSwapRates).then((rates) => {
    if (!rates) {console.error('Failed to fetch Helium swap rates.'); return;}
    console.log('Helium Swap Rates:', rates);
}).catch((error) => {
    console.error('Error fetching Helium swap rates:', error);
});