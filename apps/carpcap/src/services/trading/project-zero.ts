// DISABLED: this file is experimental/unused (not imported anywhere) and does not
// type-check against the current @0dotxyz/p0-ts-sdk API. Commented out to unblock
// the build. Restore + fix before wiring project-zero trading back in.

// import { Connection, PublicKey } from "@solana/web3.js";
// import { Project0Client, getConfig } from "@0dotxyz/p0-ts-sdk";
//
// // Connect to Solana
// const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
//
// // Get configuration (mainnet-beta)
// const config = getConfig("production");
//
// // Initialize the client (loads all banks and oracle prices)
// const client = await Project0Client.initialize(connection, config);
//
// console.log(`Loaded ${client.banks.length} banks`);
//
// import { MarginfiAccount, MarginfiAccountWrapper } from "@0dotxyz/p0-ts-sdk";
//
// const accountAddress = new PublicKey("YOUR_MARGINFI_ACCOUNT_ADDRESS");
//
// // Fetch your account
// const account = await MarginfiAccount.fetch(accountAddress, client.program);
//
// // Wrap it for cleaner API
// const wrappedAccount = new MarginfiAccountWrapper(account, client);
//
// import { AssetTag } from "@0dotxyz/p0-ts-sdk";
//
// // Option 1: Get bank by address
// const bank = client.getBank(new PublicKey("BANK_ADDRESS"));
//
// // Option 2: Get all banks for a mint (e.g., USDC)
// const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// const usdcBanks = client.getBanksByMint(USDC_MINT);
//
// // Build deposit transaction
// const depositTx = await wrappedAccount.makeDepositTx(
//   usdcBank.address,
//   "100" // Amount in UI units (100 USDC)
// );
//
// // Simulate (optional, but recommended)
// const simulation = await connection.simulateTransaction(depositTx);
// console.log(`Compute units: ${simulation.value.unitsConsumed}`);
//
// // Sign and send
// // depositTx.sign([wallet]);
// // await connection.sendTransaction(depositTx);
//
// // Check how much you can borrow
// const maxBorrow = wrappedAccount.computeMaxBorrowForBank(usdcBank.address);
// console.log(`Max borrow: $${maxBorrow.toString()}`);
//
// // Build borrow transaction
// const borrowTx = await wrappedAccount.makeBorrowTx(
//   usdcBank.address,
//   "100" // Borrow 100 USDC
// );
//
// // Send transaction...
//
// import { MarginRequirementType } from "@0dotxyz/p0-ts-sdk";
//
// // Get free collateral in USD
// const freeCollateral = wrappedAccount.computeFreeCollateral();
// console.log(`Free collateral: $${freeCollateral.toString()}`);
//
// // Get health components
// const health = wrappedAccount.computeHealthComponents(MarginRequirementType.Initial);
//
// const healthFactor = health.assets.div(health.liabilities);
// console.log(`Health factor: ${healthFactor.toString()}`);
//
// /**
//  * Example: Account Health with Legacy Calculation
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Fetch a marginfi account
//  * 3. Calculate health metrics using oracle prices directly (legacy method)
//  * 4. Compare results with cached health values
//  *
//  * The legacy calculation approach:
//  * - Uses current oracle prices from the client
//  * - Manually calculates asset and liability values
//  * - Applies margin requirements (init, maintenance, equity)
//  * - Does NOT simulate on-chain transactions
//  * - Faster but may differ from on-chain health cache
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your configuration values
//  * 3. Run: tsx 06b-account-health-legacy.ts
//  */
//
// import {
//   Project0Client,
//   MarginfiAccount,
//   MarginRequirementType,
// } from "../src";
// import { getConnection, getMarginfiConfig, getAccountAddress } from "./config";
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function accountHealthCalculatedExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Project0Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log(`✅ Client initialized`);
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Load Marginfi Account
//   // --------------------------------------------------------------------------
//   console.log("\n👤 Loading marginfi account...");
//
//   const accountAddress = getAccountAddress();
//   const account = await MarginfiAccount.fetch(accountAddress, client.program);
//
//   console.log(`✅ Account loaded: ${account.address.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 4: Compute Health Using Legacy Method
//   // --------------------------------------------------------------------------
//   console.log("\n🧮 Computing health using legacy method (oracle prices)...");
//   console.log(
//     "   This uses current oracle prices to calculate health directly"
//   );
//
//   // Compute health components using legacy method
//   const initHealthLegacy = account.computeHealthComponentsLegacy(
//     client.bankMap,
//     client.oraclePriceByBank,
//     MarginRequirementType.Initial
//   );
//
//   const maintHealthLegacy = account.computeHealthComponentsLegacy(
//     client.bankMap,
//     client.oraclePriceByBank,
//     MarginRequirementType.Maintenance
//   );
//
//   const equityHealthLegacy = account.computeHealthComponentsLegacy(
//     client.bankMap,
//     client.oraclePriceByBank,
//     MarginRequirementType.Equity
//   );
//
//   console.log("✅ Legacy calculation complete");
//
//   // --------------------------------------------------------------------------
//   // Step 5: Display Legacy Health Metrics
//   // --------------------------------------------------------------------------
//   console.log("\n📊 Health Metrics (legacy calculation):\n");
//
//   console.log("💰 Initial Health (for borrowing):");
//   console.log(`   Assets: $${initHealthLegacy.assets.toFixed(2)}`);
//   console.log(`   Liabilities: $${initHealthLegacy.liabilities.toFixed(2)}`);
//   if (initHealthLegacy.liabilities.gt(0)) {
//     console.log(
//       `   Health Factor: ${initHealthLegacy.assets.div(initHealthLegacy.liabilities).toFixed(4)}`
//     );
//   } else {
//     console.log(`   Health Factor: ∞ (no liabilities)`);
//   }
//
//   console.log("\n💰 Maintenance Health (for liquidation):");
//   console.log(`   Assets: $${maintHealthLegacy.assets.toFixed(2)}`);
//   console.log(`   Liabilities: $${maintHealthLegacy.liabilities.toFixed(2)}`);
//   if (maintHealthLegacy.liabilities.gt(0)) {
//     console.log(
//       `   Health Factor: ${maintHealthLegacy.assets.div(maintHealthLegacy.liabilities).toFixed(4)}`
//     );
//   } else {
//     console.log(`   Health Factor: ∞ (no liabilities)`);
//   }
//
//   console.log("\n💰 Equity (actual value):");
//   console.log(`   Assets: $${equityHealthLegacy.assets.toFixed(2)}`);
//   console.log(`   Liabilities: $${equityHealthLegacy.liabilities.toFixed(2)}`);
//   console.log(
//     `   Net Value: $${equityHealthLegacy.assets.minus(equityHealthLegacy.liabilities).toFixed(2)}`
//   );
//
//   // Compute free collateral using legacy method
//   const freeCollateralLegacy = account.computeFreeCollateralLegacy(
//     client.bankMap,
//     client.oraclePriceByBank
//   );
//   console.log(`\n💵 Free Collateral: $${freeCollateralLegacy.toFixed(2)}`);
//   console.log("   (Additional borrowing power available)");
//
//   // Net APY
//   const netApy = account.computeNetApy(
//     client.bankMap,
//     client.oraclePriceByBank
//   );
//   console.log(`\n📈 Net APY: ${(netApy * 100).toFixed(4)}%`);
//
//   // --------------------------------------------------------------------------
//   // Step 6: Compare with Cached Health Values
//   // --------------------------------------------------------------------------
//   console.log("\n🔍 Comparison with On-Chain Health Cache:");
//   console.log("   (Cache may be stale - use simulation for fresh values)\n");
//
//   console.log("   Initial Health:");
//   console.log(
//     `     Legacy: $${initHealthLegacy.assets.toFixed(2)} / $${initHealthLegacy.liabilities.toFixed(2)}`
//   );
//   console.log(
//     `     Cached: $${account.healthCache.assetValue.toFixed(2)} / $${account.healthCache.liabilityValue.toFixed(2)}`
//   );
//
//   const initDiff = initHealthLegacy.assets
//     .minus(account.healthCache.assetValue)
//     .abs();
//   console.log(`     Difference: $${initDiff.toFixed(2)}`);
//
//   console.log("\n   Maintenance Health:");
//   console.log(
//     `     Legacy: $${maintHealthLegacy.assets.toFixed(2)} / $${maintHealthLegacy.liabilities.toFixed(2)}`
//   );
//   console.log(
//     `     Cached: $${account.healthCache.assetValueMaint.toFixed(2)} / $${account.healthCache.liabilityValueMaint.toFixed(2)}`
//   );
//
//   const maintDiff = maintHealthLegacy.assets
//     .minus(account.healthCache.assetValueMaint)
//     .abs();
//   console.log(`     Difference: $${maintDiff.toFixed(2)}`);
//
//   // --------------------------------------------------------------------------
//   // Step 7: Show Individual Balances with Prices
//   // --------------------------------------------------------------------------
//   console.log("\n📦 Active Balances (with current oracle prices):");
//
//   const activeBalances = account.balances.filter((b) => b.active);
//
//   if (activeBalances.length === 0) {
//     console.log("   No active balances");
//   } else {
//     activeBalances.forEach((balance) => {
//       const bank = client.bankMap.get(balance.bankPk.toBase58());
//       if (bank) {
//         const oraclePrice = client.oraclePriceByBank.get(
//           balance.bankPk.toBase58()
//         );
//
//         console.log(
//           `\n   ${bank.tokenSymbol || bank.mint.toBase58().slice(0, 8)}:`
//         );
//         console.log(`      Bank: ${bank.address.toBase58()}`);
//
//         if (oraclePrice) {
//           console.log(
//             `      Oracle Price: $${oraclePrice.priceRealtime.price.toFixed(6)} (conf: ${oraclePrice.priceRealtime.confidence.toFixed(6)})`
//           );
//         }
//
//         if (!balance.assetShares.isZero()) {
//           const assetQuantity = bank.getAssetQuantity(balance.assetShares);
//           const uiAsset = assetQuantity.div(Math.pow(10, bank.mintDecimals));
//           console.log(`      Assets: ${uiAsset.toFixed(6)} tokens`);
//
//           if (oraclePrice) {
//             const assetValue = uiAsset.times(oraclePrice.priceRealtime.price);
//             console.log(`      Asset Value: $${assetValue.toFixed(2)}`);
//           }
//         }
//
//         if (!balance.liabilityShares.isZero()) {
//           const liabilityQuantity = bank.getLiabilityQuantity(
//             balance.liabilityShares
//           );
//           const uiLiability = liabilityQuantity.div(
//             Math.pow(10, bank.mintDecimals)
//           );
//           console.log(`      Liabilities: ${uiLiability.toFixed(6)} tokens`);
//
//           if (oraclePrice) {
//             const liabilityValue = uiLiability.times(
//               oraclePrice.priceRealtime.price
//             );
//             console.log(`      Liability Value: $${liabilityValue.toFixed(2)}`);
//           }
//         }
//       }
//     });
//   }
//
//   // --------------------------------------------------------------------------
//   // Step 8: Explanation of Differences
//   // --------------------------------------------------------------------------
//   console.log("\n\n📚 Understanding the Difference:");
//   console.log("   Legacy Calculation:");
//   console.log("   ✅ Uses current oracle prices");
//   console.log("   ✅ Fast computation (no simulation)");
//   console.log("   ✅ Good for quick estimates");
//   console.log("   ⚠️  May differ from on-chain health cache");
//   console.log("   ⚠️  Oracle prices may have changed since last update");
//
//   console.log("\n   Health Cache (on-chain):");
//   console.log("   ✅ Matches actual on-chain state");
//   console.log("   ✅ Used by protocol for health checks");
//   console.log("   ⚠️  May be stale (needs PulseHealth to update)");
//   console.log("   ⚠️  Oracle prices frozen at last update time");
//
//   console.log("\n   Use simulation (06a-account-health-simulated.ts) for:");
//   console.log("   ✅ Most accurate health values");
//   console.log("   ✅ Refreshed oracle prices");
//   console.log("   ✅ Updated health cache");
//   console.log("   ⚠️  Slower (requires simulation)");
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// accountHealthCalculatedExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//   /**
//  * Example: Account Health with Cache Simulation
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Fetch a marginfi account
//  * 3. Simulate the health cache by refreshing oracles and updating on-chain data
//  * 4. Read health metrics from the simulated cache
//  *
//  * The simulation approach:
//  * - Refreshes Switchboard oracle feeds
//  * - Refreshes Kamino reserve data
//  * - Calls the PulseHealth instruction to update the health cache
//  * - Simulates the transaction and reads the updated account data
//  * - Provides the most accurate, up-to-date health information
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your configuration values
//  * 3. Run: tsx 06a-account-health-simulated.ts
//  */
//
// import {
//   Project0Client,
//   MarginfiAccountWrapper,
//   MarginfiAccount,
//   MarginRequirementType,
//   simulateAccountHealthCacheWithFallback,
// } from "../src";
// import { getConnection, getMarginfiConfig, getAccountAddress } from "./config";
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function accountHealthSimulatedExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Project0Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log(`✅ Client initialized`);
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Load Marginfi Account
//   // --------------------------------------------------------------------------
//   console.log("\n👤 Loading marginfi account...");
//
//   const accountAddress = getAccountAddress();
//   const account = await MarginfiAccount.fetch(accountAddress, client.program);
//
//   console.log(`✅ Account loaded: ${account.address.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 4: Simulate Health Cache
//   // --------------------------------------------------------------------------
//   console.log("\n🔄 Simulating health cache update...");
//   console.log(
//     "   This simulates refreshing oracles and calling PulseHealth on-chain"
//   );
//
//   const { marginfiAccount: simulatedAccountData, error } =
//     await simulateAccountHealthCacheWithFallback({
//       program: client.program,
//       bankMap: client.bankMap,
//       oraclePrices: client.oraclePriceByBank,
//       marginfiAccount: account,
//       balances: account.balances,
//       bankMetadataMap: client.bankIntegrationMap,
//     });
//
//   if (error) {
//     console.warn(`⚠️  Health cache simulation had issues: ${error.message}`);
//     console.log("   Falling back to legacy calculation");
//   } else {
//     console.log("✅ Health cache simulated successfully");
//   }
//
//   // Update the account with simulated health cache
//   account.healthCache = simulatedAccountData.healthCache;
//
//   // --------------------------------------------------------------------------
//   // Step 5: Display Health Metrics from Simulated Cache
//   // --------------------------------------------------------------------------
//   console.log("\n📊 Health Metrics (from simulated cache):\n");
//
//   const wrappedAccount = new MarginfiAccountWrapper(account, client);
//
//   // Health components use the simulated cache
//   const initHealth = wrappedAccount.computeHealthComponents(
//     MarginRequirementType.Initial
//   );
//   const maintHealth = wrappedAccount.computeHealthComponents(
//     MarginRequirementType.Maintenance
//   );
//   const equityHealth = wrappedAccount.computeHealthComponents(
//     MarginRequirementType.Equity
//   );
//
//   console.log("💰 Initial Health (for borrowing):");
//   console.log(`   Assets: $${initHealth.assets.toFixed(2)}`);
//   console.log(`   Liabilities: $${initHealth.liabilities.toFixed(2)}`);
//   if (initHealth.liabilities.gt(0)) {
//     console.log(
//       `   Health Factor: ${initHealth.assets.div(initHealth.liabilities).toFixed(4)}`
//     );
//   }
//
//   console.log("\n💰 Maintenance Health (for liquidation):");
//   console.log(`   Assets: $${maintHealth.assets.toFixed(2)}`);
//   console.log(`   Liabilities: $${maintHealth.liabilities.toFixed(2)}`);
//   if (maintHealth.liabilities.gt(0)) {
//     console.log(
//       `   Health Factor: ${maintHealth.assets.div(maintHealth.liabilities).toFixed(4)}`
//     );
//   }
//
//   console.log("\n💰 Equity (actual value):");
//   console.log(`   Assets: $${equityHealth.assets.toFixed(2)}`);
//   console.log(`   Liabilities: $${equityHealth.liabilities.toFixed(2)}`);
//   console.log(
//     `   Net Value: $${equityHealth.assets.minus(equityHealth.liabilities).toFixed(2)}`
//   );
//
//   // Free collateral
//   const freeCollateral = wrappedAccount.computeFreeCollateral();
//   console.log(`\n💵 Free Collateral: $${freeCollateral.toFixed(2)}`);
//   console.log("   (Additional borrowing power available)");
//
//   // Account value
//   const accountValue = wrappedAccount.computeAccountValue();
//   console.log(`\n💎 Account Value (Equity): $${accountValue.toFixed(2)}`);
//
//   // Net APY
//   const netApy = wrappedAccount.computeNetApy();
//   console.log(`\n📈 Net APY: ${(netApy * 100).toFixed(4)}%`);
//
//   // --------------------------------------------------------------------------
//   // Step 6: Display Cache Details
//   // --------------------------------------------------------------------------
//   console.log("\n🔍 Health Cache Details:");
//   console.log(
//     `   Asset Value (Init): $${account.healthCache.assetValue.toFixed(2)}`
//   );
//   console.log(
//     `   Liability Value (Init): $${account.healthCache.liabilityValue.toFixed(2)}`
//   );
//   console.log(
//     `   Asset Value (Maint): $${account.healthCache.assetValueMaint.toFixed(2)}`
//   );
//   console.log(
//     `   Liability Value (Maint): $${account.healthCache.liabilityValueMaint.toFixed(2)}`
//   );
//   console.log(
//     `   Asset Value (Equity): $${account.healthCache.assetValueEquity.toFixed(2)}`
//   );
//   console.log(
//     `   Liability Value (Equity): $${account.healthCache.liabilityValueEquity.toFixed(2)}`
//   );
//   console.log(
//     `   Cache Status: ${account.healthCache.simulationStatus || "SIMULATED"}`
//   );
//
//   // --------------------------------------------------------------------------
//   // Step 7: Show Individual Balances
//   // --------------------------------------------------------------------------
//   console.log("\n📦 Active Balances:");
//
//   const activeBalances = account.balances.filter((b) => b.active);
//
//   if (activeBalances.length === 0) {
//     console.log("   No active balances");
//   } else {
//     activeBalances.forEach((balance) => {
//       const bank = client.bankMap.get(balance.bankPk.toBase58());
//       if (bank) {
//         console.log(
//           `\n   ${bank.tokenSymbol || bank.mint.toBase58().slice(0, 8)}:`
//         );
//
//         const assetQuantity = bank.getAssetQuantity(balance.assetShares);
//         const liabilityQuantity = bank.getLiabilityQuantity(
//           balance.liabilityShares
//         );
//
//         if (!balance.assetShares.isZero()) {
//           const uiAsset = assetQuantity.div(Math.pow(10, bank.mintDecimals));
//           console.log(`      Assets: ${uiAsset.toFixed(6)} tokens`);
//         }
//
//         if (!balance.liabilityShares.isZero()) {
//           const uiLiability = liabilityQuantity.div(
//             Math.pow(10, bank.mintDecimals)
//           );
//           console.log(`      Liabilities: ${uiLiability.toFixed(6)} tokens`);
//         }
//       }
//     });
//   }
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// accountHealthSimulatedExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//   /**
//  * Example: Fetch oracle prices
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Access oracle prices for all banks
//  * 3. Crank/update oracle prices
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your configuration values
//  * 3. Run: tsx 05-oracle-prices.ts
//  */
//
// import { PublicKey } from "@solana/web3.js";
// import { Project0Client, fetchOracleData } from "../src";
// import { getConnection, getMarginfiConfig } from "./config";
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function oraclePricesExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log("✅ Client initialized with oracle prices");
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Access Oracle Prices for All Banks
//   // --------------------------------------------------------------------------
//   console.log("\n💰 Accessing oracle prices for all banks...\n");
//
//   client.bankMap.forEach((bank, bankAddress) => {
//     const oraclePrice = client.oraclePriceByBank.get(bankAddress);
//
//     if (oraclePrice) {
//       console.log(`Bank: ${bank.mint.toBase58()}`);
//       console.log(
//         `   Realtime price: $${oraclePrice.priceRealtime.price.toNumber()}`
//       );
//       console.log(
//         `   Confidence: ±$${oraclePrice.priceRealtime.confidence.toNumber()}`
//       );
//       console.log(
//         `   Timestamp: ${new Date(oraclePrice.timestamp.toNumber() * 1000).toISOString()}`
//       );
//       console.log("");
//     }
//   });
//
//   // --------------------------------------------------------------------------
//   // Step 4: Manually Refresh Oracle Prices
//   // --------------------------------------------------------------------------
//   console.log("🔄 Refreshing oracle prices...");
//
//   const updatedOracleData = await fetchOracleData(
//     client.banks, // Array of all banks
//     {
//       pythOpts: {
//         mode: "on-chain", // or "api" for faster lookups
//         connection,
//       },
//       swbOpts: {
//         mode: "on-chain",
//         connection,
//       },
//       isolatedBanksOpts: {
//         fetchPrices: true,
//       },
//     }
//   );
//
//   console.log(
//     `✅ Refreshed ${updatedOracleData.bankOraclePriceMap.size} oracle prices`
//   );
//
//   // --------------------------------------------------------------------------
//   // Step 5: Access Specific Bank Oracle Price
//   // --------------------------------------------------------------------------
//   console.log("\n💵 Accessing specific bank oracle price...");
//
//   const usdcMint = new PublicKey(
//     "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
//   );
//   const usdcOraclePrice = updatedOracleData.mintOraclePriceMap.get(
//     usdcMint.toBase58()
//   );
//
//   if (usdcOraclePrice) {
//     console.log(
//       `   USDC Price: $${usdcOraclePrice.priceRealtime.price.toNumber()}`
//     );
//   }
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// oraclePricesExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//   /**
//  * Example: Repay borrowed tokens
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Fetch a marginfi account
//  * 3. Check liability positions (borrows)
//  * 4. Find the first position with a liability
//  * 5. Calculate repay amount (10% of liability)
//  * 6. Build and simulate repay transaction
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your configuration values
//  * 3. Run: tsx 04-repay.ts
//  */
//
// import {
//   Project0Client,
//   MarginfiAccountWrapper,
//   MarginfiAccount,
// } from "../src";
// import {
//   getConnection,
//   getMarginfiConfig,
//   getAccountAddress,
//   getWalletPubkey,
// } from "./config";
//
// // ============================================================================
// // Configuration
// // ============================================================================
//
// const REPAY_ALL = false; // Set to true to repay entire debt
// const REPAY_PERCENTAGE = 0.1; // Repay 10% of the liability
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function repayExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const walletPubkey = getWalletPubkey();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//   console.log(`   Wallet: ${walletPubkey.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log(`✅ Client initialized`);
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Load Marginfi Account
//   // --------------------------------------------------------------------------
//   console.log("\n👤 Loading marginfi account...");
//
//   const accountAddress = getAccountAddress();
//   const account = await MarginfiAccount.fetch(accountAddress, client.program);
//   const wrappedAccount = new MarginfiAccountWrapper(account, client);
//
//   console.log(`✅ Account loaded: ${account.address.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 4: Find First Liability Position
//   // --------------------------------------------------------------------------
//   console.log("\n💸 Checking liability positions...");
//
//   // Get all active liability positions (borrows)
//   const liabilityBalances = account.balances.filter(
//     (balance) => balance.active && !balance.liabilityShares.isZero()
//   );
//
//   console.log(`   Found ${liabilityBalances.length} active liability position(s)`);
//
//   if (liabilityBalances.length === 0) {
//     throw new Error("No liability positions found. Borrow some tokens first.");
//   }
//
//   // Use the first liability position
//   const firstLiability = liabilityBalances[0];
//   const bankAddress = firstLiability.bankPk;
//   const bank = client.bankMap.get(bankAddress.toBase58());
//
//   if (!bank) {
//     throw new Error(`Bank ${bankAddress.toBase58()} not found`);
//   }
//
//   // Calculate the token amount from liability shares
//   const liabilityAmount = bank.getLiabilityQuantity(firstLiability.liabilityShares);
//   const uiAmount = liabilityAmount.div(Math.pow(10, bank.mintDecimals));
//
//   console.log(`\n✅ Selected first liability position:`);
//   console.log(`   Bank: ${bank.address.toBase58()}`);
//   console.log(`   Mint: ${bank.mint.toBase58()}`);
//   console.log(`   Liability: ${uiAmount.toFixed(6)} tokens`);
//
//   // --------------------------------------------------------------------------
//   // Step 5: Calculate Repay Amount
//   // --------------------------------------------------------------------------
//   console.log("\n📊 Calculating repay amount...");
//
//   // Repay a percentage of the liability
//   const repayAmount = Math.min(
//     uiAmount.toNumber() * REPAY_PERCENTAGE,
//     uiAmount.toNumber() // But not more than the total liability
//   ).toString();
//
//   console.log(`   Repaying: ${repayAmount} tokens (${REPAY_PERCENTAGE * 100}% of liability)`);
//
//   // --------------------------------------------------------------------------
//   // Step 6: Build Repay Transaction
//   // --------------------------------------------------------------------------
//   console.log(`\n📝 Building repay transaction...`);
//
//   const repayTx = await wrappedAccount.makeRepayTx(
//     bank.address,
//     repayAmount,
//     REPAY_ALL
//   );
//
//   console.log(`✅ Transaction built successfully`);
//
//   // --------------------------------------------------------------------------
//   // Step 7: Simulate Transaction
//   // --------------------------------------------------------------------------
//   console.log("\n🔄 Simulating transaction...");
//
//   // Prepare transaction for simulation
//   const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//   repayTx.recentBlockhash = recentBlockhash;
//   repayTx.feePayer = walletPubkey;
//
//   // Run simulation
//   try {
//     const simulation = await connection.simulateTransaction(repayTx);
//
//     if (simulation.value.err) {
//       console.error("\n❌ Simulation failed:", simulation.value.err);
//       console.error("\nLogs:", simulation.value.logs);
//       return;
//     }
//
//     // Simulation successful
//     console.log("\n✅ Simulation successful!");
//     console.log(`   Compute units used: ${simulation.value.unitsConsumed}`);
//
//     if (simulation.value.logs && simulation.value.logs.length > 0) {
//       console.log("\n📋 Transaction logs:");
//       simulation.value.logs.forEach((log) => console.log(`   ${log}`));
//     }
//   } catch (error) {
//     console.error("\n❌ Simulation error:", error);
//     throw error;
//   }
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// repayExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//   /**
//  * Example: Withdraw tokens from a bank
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Fetch a marginfi account
//  * 3. Check lending balances (deposits)
//  * 4. Find the first position with a balance
//  * 5. Calculate max withdraw capacity
//  * 6. Build and simulate withdraw transaction
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your configuration values
//  * 3. Run: tsx 03-withdraw.ts
//  */
//
// import {
//   Project0Client,
//   MarginfiAccountWrapper,
//   MarginfiAccount,
//   simulateBundle,
// } from "../src";
// import {
//   getConnection,
//   getMarginfiConfig,
//   getAccountAddress,
//   getWalletPubkey,
//   MINTS,
// } from "./config";
//
// // ============================================================================
// // Configuration
// // ============================================================================
//
// const WITHDRAW_ALL = false; // Set to true to withdraw entire position
// const WITHDRAW_PERCENTAGE = 0.1; // Withdraw 10% of available balance
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function withdrawExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const walletPubkey = getWalletPubkey();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//   console.log(`   Wallet: ${walletPubkey.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log(`✅ Client initialized`);
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Load Marginfi Account
//   // --------------------------------------------------------------------------
//   console.log("\n👤 Loading marginfi account...");
//
//   const accountAddress = getAccountAddress();
//   const account = await MarginfiAccount.fetch(accountAddress, client.program);
//   const wrappedAccount = new MarginfiAccountWrapper(account, client);
//
//   console.log(`✅ Account loaded: ${account.address.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 4: Find First Lending Position
//   // --------------------------------------------------------------------------
//   console.log("\n💰 Checking lending balances...");
//
//   // Get all active lending positions (deposits)
//   const lendingBalances = account.balances.filter(
//     (balance) => balance.active && !balance.assetShares.isZero()
//   );
//
//   console.log(`   Found ${lendingBalances.length} active lending position(s)`);
//
//   if (lendingBalances.length === 0) {
//     throw new Error("No lending positions found. Deposit some tokens first.");
//   }
//
//   // Use the first lending position
//   const firstBalance = lendingBalances[0];
//   const bankAddress = firstBalance.bankPk;
//   const bank = client.bankMap.get(bankAddress.toBase58());
//
//   if (!bank) {
//     throw new Error(`Bank ${bankAddress.toBase58()} not found`);
//   }
//
//   // Calculate the token amount from shares
//   const tokenAmount = bank.getAssetQuantity(firstBalance.assetShares);
//   const uiAmount = tokenAmount.div(Math.pow(10, bank.mintDecimals));
//
//   console.log(`\n✅ Selected first lending position:`);
//   console.log(`   Bank: ${bank.address.toBase58()}`);
//   console.log(`   Mint: ${bank.mint.toBase58()}`);
//   console.log(`   Balance: ${uiAmount.toFixed(6)} tokens`);
//
//   // --------------------------------------------------------------------------
//   // Step 5: Check Withdraw Capacity
//   // --------------------------------------------------------------------------
//   console.log("\n📊 Checking withdraw capacity...");
//
//   const maxWithdraw = wrappedAccount.computeMaxWithdrawForBank(bank.address);
//   console.log(`   Max withdraw: ${maxWithdraw.toString()} tokens`);
//
//   // Calculate actual withdraw amount (percentage of balance)
//   const withdrawAmount = Math.min(
//     uiAmount.toNumber() * WITHDRAW_PERCENTAGE,
//     maxWithdraw.toNumber()
//   ).toString();
//
//   console.log(
//     `   Withdrawing: ${withdrawAmount} tokens (${WITHDRAW_PERCENTAGE * 100}% of balance)`
//   );
//
//   // --------------------------------------------------------------------------
//   // Step 6: Build Withdraw Transaction (based on asset tag)
//   // --------------------------------------------------------------------------
//   console.log(`\n📝 Building withdraw transaction...`);
//   console.log(`   Asset tag: ${bank.config.assetTag}`);
//
//   const assetTag = bank.config.assetTag;
//   let withdrawResult;
//
//   switch (assetTag) {
//     case 0: // AssetTag.DEFAULT
//     case 1: {
//       // AssetTag.SOL
//       console.log(`   Using standard withdraw for DEFAULT/SOL bank`);
//       withdrawResult = await wrappedAccount.makeWithdrawTx(
//         bank.address,
//         withdrawAmount,
//         WITHDRAW_ALL
//       );
//       break;
//     }
//
//     case 3: {
//       // AssetTag.KAMINO
//       console.log(`   Using Kamino withdraw for KAMINO bank`);
//       const bankAddress = bank.address.toBase58();
//       const kaminoState = client.bankIntegrationMap[bankAddress]?.kaminoStates;
//
//       if (!kaminoState) {
//         throw new Error("Kamino reserve state not available");
//       }
//
//       withdrawResult = await wrappedAccount.makeKaminoWithdrawTx(
//         bank.address,
//         withdrawAmount,
//         kaminoState.reserveState,
//         WITHDRAW_ALL
//       );
//       break;
//     }
//
//     default: {
//       // STAKED (2) or any other asset tags not yet supported
//       throw new Error(
//         `Withdraw not implemented for asset tag ${assetTag}. ` +
//           `Supported tags: 0 (DEFAULT), 1 (SOL), 3 (KAMINO)`
//       );
//     }
//   }
//
//   console.log(`✅ Transaction built successfully`);
//   console.log(`   Total transactions: ${withdrawResult.transactions.length}`);
//   console.log(`   Action transaction index: ${withdrawResult.actionTxIndex}`);
//
//   // --------------------------------------------------------------------------
//   // Step 7: Simulate Transaction Bundle
//   // --------------------------------------------------------------------------
//   console.log("\n🔄 Simulating transaction bundle...");
//
//   try {
//     const simulationResults = await simulateBundle(
//       connection.rpcEndpoint,
//       withdrawResult.transactions
//     );
//
//     console.log("\n✅ Bundle simulation successful!");
//     simulationResults.forEach((result, index) => {
//       console.log(`\n   Transaction ${index + 1}:`);
//       if (result.err) {
//         console.log(`   ❌ Error: ${JSON.stringify(result.err)}`);
//         if (result.logs && result.logs.length > 0) {
//           console.log(`   Logs:`);
//           result.logs.forEach((log) => console.log(`     ${log}`));
//         }
//       } else {
//         console.log(`   ✅ Success`);
//         console.log(`   Compute units: ${result.unitsConsumed || "N/A"}`);
//       }
//     });
//   } catch (error) {
//     console.error("\n❌ Simulation error:", error);
//     throw error;
//   }
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// withdrawExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//   /**
//  * Example: Borrow tokens from a bank
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Fetch a marginfi account
//  * 3. Create a wrapper for clean API
//  * 4. Check max borrow capacity
//  * 5. Build and simulate borrow transaction
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your configuration values
//  * 3. Run: tsx 02-borrow.ts
//  */
//
// import {
//   Project0Client,
//   MarginfiAccountWrapper,
//   MarginfiAccount,
//   AssetTag,
//   simulateBundle,
// } from "../src";
// import {
//   getConnection,
//   getMarginfiConfig,
//   getAccountAddress,
//   getWalletPubkey,
//   MINTS,
// } from "./config";
//
// // ============================================================================
// // Configuration
// // ============================================================================
//
// const BORROW_AMOUNT = "50"; // USDC amount to borrow (UI units)
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function borrowExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const walletPubkey = getWalletPubkey();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//   console.log(`   Wallet: ${walletPubkey.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log(`✅ Client initialized`);
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Load Marginfi Account
//   // --------------------------------------------------------------------------
//   console.log("\n👤 Loading marginfi account...");
//
//   const accountAddress = getAccountAddress();
//   const account = await MarginfiAccount.fetch(accountAddress, client.program);
//   const wrappedAccount = new MarginfiAccountWrapper(account, client);
//
//   console.log(`✅ Account loaded: ${account.address.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 4: Select Bank
//   // --------------------------------------------------------------------------
//   console.log("\n🏦 Selecting USDC bank...");
//
//   const usdcBanks = client.getBanksByMint(MINTS.USDC, AssetTag.DEFAULT);
//
//   if (usdcBanks.length === 0) {
//     throw new Error("USDC bank not found");
//   }
//
//   const usdcBank = usdcBanks[0];
//   console.log(`✅ Bank selected: ${usdcBank.address.toBase58()}`);
//   console.log(`   Mint: ${usdcBank.mint.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 5: Check Borrow Capacity
//   // --------------------------------------------------------------------------
//   console.log("\n📊 Checking borrow capacity...");
//
//   const maxBorrow = wrappedAccount.computeMaxBorrowForBank(usdcBank.address);
//   console.log(`   Max borrow: ${maxBorrow.toString()} USDC`);
//
//   // --------------------------------------------------------------------------
//   // Step 6: Build Borrow Transaction
//   // --------------------------------------------------------------------------
//   const actualBorrowAmount = Math.min(
//     Number(BORROW_AMOUNT),
//     maxBorrow.toNumber()
//   ).toString();
//   console.log(
//     `\n📝 Building borrow transaction for ${actualBorrowAmount} USDC...`
//   );
//
//   const borrowResult = await wrappedAccount.makeBorrowTx(
//     usdcBank.address,
//     actualBorrowAmount
//   );
//
//   console.log(`✅ Transaction built successfully`);
//   console.log(`   Total transactions: ${borrowResult.transactions.length}`);
//   console.log(`   Action transaction index: ${borrowResult.actionTxIndex}`);
//
//   // --------------------------------------------------------------------------
//   // Step 7: Simulate Transaction Bundle
//   // --------------------------------------------------------------------------
//   console.log("\n🔄 Simulating transaction bundle...");
//
//   try {
//     const simulationResults = await simulateBundle(connection.rpcEndpoint, borrowResult.transactions);
//
//     console.log("\n✅ Bundle simulation successful!");
//     simulationResults.forEach((result, index) => {
//       console.log(`\n   Transaction ${index + 1}:`);
//       if (result.err) {
//         console.log(`   ❌ Error: ${JSON.stringify(result.err)}`);
//         if (result.logs && result.logs.length > 0) {
//           console.log(`   Logs:`);
//           result.logs.forEach(log => console.log(`     ${log}`));
//         }
//       } else {
//         console.log(`   ✅ Success`);
//         console.log(`   Compute units: ${result.unitsConsumed || 'N/A'}`);
//       }
//     });
//   } catch (error) {
//     console.error("\n❌ Simulation error:", error);
//     throw error;
//   }
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// borrowExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//   /**
//  * Example: Deposit tokens into a bank (SIMULATION MODE)
//  *
//  * This example shows how to:
//  * 1. Initialize the Project0Client from config
//  * 2. Fetch a marginfi account
//  * 3. Create a wrapper for clean API
//  * 4. Build deposit instructions and simulate
//  *
//  * Setup:
//  * 1. Copy .env.example to .env
//  * 2. Fill in your MARGINFI_ACCOUNT_ADDRESS and WALLET_ADDRESS (no private key needed!)
//  * 3. Run: tsx 01-deposit.ts
//  *
//  * Note: This runs in SIMULATION mode - no actual transactions are sent.
//  */
//
// import {
//   Project0Client,
//   MarginfiAccountWrapper,
//   MarginfiAccount,
//   AssetTag,
// } from "../src";
// import { Transaction } from "@solana/web3.js";
// import {
//   getConnection,
//   getMarginfiConfig,
//   getAccountAddress,
//   getWalletPubkey,
//   MINTS,
// } from "./config";
//
// // ============================================================================
// // Configuration
// // ============================================================================
//
// const DEPOSIT_AMOUNT = "0.001"; // SOL amount to deposit (UI units)
//
// // ============================================================================
// // Main Example
// // ============================================================================
//
// async function depositExample() {
//   // --------------------------------------------------------------------------
//   // Step 1: Load Configuration
//   // --------------------------------------------------------------------------
//   console.log("\n🔧 Loading configuration...");
//
//   const connection = getConnection();
//   const walletPubkey = getWalletPubkey();
//   const config = getMarginfiConfig();
//
//   console.log(`   RPC: ${connection.rpcEndpoint}`);
//   console.log(`   Environment: ${config.environment}`);
//   console.log(`   Wallet: ${walletPubkey.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 2: Initialize Client
//   // --------------------------------------------------------------------------
//   console.log("\n📡 Initializing Project0Client...");
//
//   const client = await Project0Client.initialize(connection, config);
//
//   console.log(`✅ Client initialized`);
//   console.log(`📊 Loaded ${client.banks.length} banks`);
//
//   // --------------------------------------------------------------------------
//   // Step 3: Load Marginfi Account
//   // --------------------------------------------------------------------------
//   console.log("\n👤 Loading marginfi account...");
//
//   const accountAddress = getAccountAddress();
//   const account = await MarginfiAccount.fetch(accountAddress, client.program);
//   const wrappedAccount = new MarginfiAccountWrapper(account, client);
//
//   console.log(`✅ Account loaded: ${account.address.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 4: Select Bank
//   // --------------------------------------------------------------------------
//   console.log("\n🏦 Selecting SOL bank...");
//
//   const solBanks = client.getBanksByMint(MINTS.SOL, AssetTag.SOL);
//
//   if (solBanks.length === 0) {
//     throw new Error("SOL bank not found");
//   }
//
//   const solBank = solBanks[0];
//   console.log(`✅ Bank selected: ${solBank.address.toBase58()}`);
//   console.log(`   Mint: ${solBank.mint.toBase58()}`);
//
//   // --------------------------------------------------------------------------
//   // Step 5: Build Deposit Transaction
//   // --------------------------------------------------------------------------
//   console.log(`\n📝 Building deposit transaction for ${DEPOSIT_AMOUNT} SOL...`);
//
//   const depositTx = await wrappedAccount.makeDepositTx(
//     solBank.address,
//     DEPOSIT_AMOUNT
//   );
//
//   console.log(`✅ Transaction built successfully`);
//
//   // --------------------------------------------------------------------------
//   // Step 6: Simulate Transaction
//   // --------------------------------------------------------------------------
//   console.log("\n🔄 Simulating transaction...");
//
//   // Prepare transaction for simulation
//   const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
//   depositTx.recentBlockhash = recentBlockhash;
//   depositTx.feePayer = walletPubkey;
//
//   // Run simulation
//   try {
//     const simulation = await connection.simulateTransaction(depositTx);
//
//     if (simulation.value.err) {
//       console.error("\n❌ Simulation failed:", simulation.value.err);
//       console.error("\nLogs:", simulation.value.logs);
//       return;
//     }
//
//     // Simulation successful
//     console.log("\n✅ Simulation successful!");
//     console.log(`   Compute units used: ${simulation.value.unitsConsumed}`);
//
//     if (simulation.value.logs && simulation.value.logs.length > 0) {
//       console.log("\n📋 Transaction logs:");
//       simulation.value.logs.forEach((log) => console.log(`   ${log}`));
//     }
//   } catch (error) {
//     console.error("\n❌ Simulation error:", error);
//     throw error;
//   }
// }
//
// // ============================================================================
// // Run Example
// // ============================================================================
//
// depositExample()
//   .then(() => {
//     process.exit(0);
//   })
//   .catch((error) => {
//     console.error("\n❌ Error:", error);
//     process.exit(1);
//   });
//
//
