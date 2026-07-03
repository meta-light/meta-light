const twentyfour_hour_network_payout_url = 'https://relay.devnet.inference.net/api/trpc/metrics.hoganEarningsLast24Hours?input=%7B%22json%22%3A%7B%7D%7D';
const historicalEarnings = 'https://relay.devnet.inference.net/api/trpc/metrics.hoganEarningsHistory?input=%7B%22json%22%3A%7B%22daysBack%22%3A60%7D%7D';
const generationsHistory = 'https://relay.devnet.inference.net/api/trpc/metrics.generationsHistory?input=%7B%22json%22%3A%7B%22hoursBack%22%3A24%7D%7D';
const rpm = 'https://relay.devnet.inference.net/api/trpc/metrics.rpm?input=%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D';
const onlineWorkers = 'https://relay.devnet.inference.net/api/trpc/metrics.runningInstanceCount?input=%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D';
const pointsLeaderboard = 'https://relay.devnet.inference.net/api/trpc/metrics.hoganEarningsLeaderboard?input=%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D';
const devices = 'https://relay.inference.supply/api/trpc/instance.hardware?batch=1'

