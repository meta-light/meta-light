export async function getAverageHeliumRewards() {
    const REWARDS_URL = 'https://world.helium.com/api/trpc/network.metricDeployedHotspots,hotspot.findAvgRewards?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%2C%221%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D'
    const rewardsResponse = await fetch(REWARDS_URL)
    const PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=helium&vs_currencies=usd'
    const priceResponse = await fetch(PRICE_URL)    
    const rewardsData = await rewardsResponse.json()
    const priceData = await priceResponse.json()
    const price = priceData.helium.usd
    const avg30dRewards = rewardsData[1].result.data.json.hnt['30_DAY'].avg;
    return {avg30dRewards, price}
}