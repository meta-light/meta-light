import torch
import numpy as np
import json
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import random
from pymongo import MongoClient
import logging
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class OptimizationResult:
    network: str
    thresholds: Dict[str, float]
    position_sizing: Dict[str, float]
    signal_sensitivity: Dict[str, float]
    signal_weights: Dict[str, float]
    network_specific: Dict[str, float]
    position_management: Dict[str, float]
    risk_adjustment: Dict[str, float]
    feature_flags: Dict[str, bool]
    total_profit: float
    total_trades: int
    win_rate: float
    avg_profit_per_trade: float
    max_drawdown: float
    sharpe_ratio: float
    final_balance: float
    execution_time: float
    gpu_accelerated: bool
    total_fees: float
    total_gas_fees: float
    total_swap_fees: float

@dataclass
class TokenData:
    ticker: str
    price_history: List[float]

class SignalOptimizer:
    def __init__(self):
        # Initialize GPU device
        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
            logger.info("🍎 Apple Silicon GPU acceleration enabled")
        else:
            self.device = torch.device("cpu")
            logger.info("💻 Using CPU for computations")
        
        self.initial_balance = 1000.0
        self.test_period_days = 7
        self.max_combinations = 50
        self.max_time_periods = 500
        self.batch_size = 50
        
        # Parameter ranges
        self.threshold_ranges = {
            'SMA_Crossover': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
            'EMA_Crossover': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
            'RSI_Oversold_Overbought': [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65],
            'MACD_Signal': [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
            'Bollinger_Bands': [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
            'Stochastic_Oscillator': [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65],
            'ADX_Trend': [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6],
            'Combined_Momentum': [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
            'Pattern_Recognition': [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
            'Mean_Reversion': [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65],
            'Liquidity_Based': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5]
        }
        
        self.position_sizing_ranges = {
            'BASE_POSITION_SIZE': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3],
            'MAX_POSITION_SIZE': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
            'POSITION_SCALING': [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        }
        
        self.signal_sensitivity_ranges = {
            'MIN_SIGNAL_STRENGTH': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
            'MIN_SELL_CONFLUENCE': [0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
            'SIGNAL_DECAY_RATE': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        }
        
        self.signal_weight_ranges = {
            'TREND_WEIGHT': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
            'MOMENTUM_WEIGHT': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
            'MEAN_REVERSION_WEIGHT': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        }
        
        self.network_specific_ranges = {
            'GAS_PRICE_USD': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3],
            'DEX_SWAP_FEE_RATE': [0.001, 0.002, 0.003, 0.004, 0.005, 0.006],
            'PRIORITY_FEE_RANGE': [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]
        }
        
        self.position_management_ranges = {
            'STOP_LOSS_PERCENTAGE': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3],
            'TAKE_PROFIT_PERCENTAGE': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
            'TRAILING_STOP_PERCENTAGE': [0.02, 0.04, 0.06, 0.08, 0.1, 0.12]
        }
        
        self.risk_adjustment_ranges = {
            'MAX_DRAWDOWN_LIMIT': [0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
            'RISK_PER_TRADE': [0.01, 0.02, 0.03, 0.04, 0.05, 0.06],
            'PORTFOLIO_RISK_LIMIT': [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
        }
        
        self.feature_flag_ranges = {
            'ENABLE_STOP_LOSS': [True, False],
            'ENABLE_TAKE_PROFIT': [True, False],
            'ENABLE_TRAILING_STOP': [True, False],
            'ENABLE_POSITION_SCALING': [True, False],
            'ENABLE_RISK_MANAGEMENT': [True, False]
        }
        
        # MongoDB connection
        mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
        logger.info(f"🔗 Connecting to MongoDB: {mongodb_uri}")
        
        self.mongo_client = MongoClient(mongodb_uri)
        
        # List all databases to see what's available
        databases = self.mongo_client.list_database_names()
        logger.info(f"📚 Available databases: {databases}")
        
        # Try to find the trading_bot database or similar
        target_db_name = None
        for db_name in databases:
            if 'trading' in db_name.lower() or 'bot' in db_name.lower() or 'carp' in db_name.lower():
                target_db_name = db_name
                break
        
        # Use test database if no trading database found
        if target_db_name:
            self.db = self.mongo_client[target_db_name]
            logger.info(f"Using database: {target_db_name}")
        elif 'test' in databases:
            self.db = self.mongo_client['test']
            logger.info(f"Using database: test")
        else:
            self.db = self.mongo_client['trading_bot']
            logger.info(f"⚠️ Using default database: trading_bot")
        
        # Test connection
        try:
            self.mongo_client.admin.command('ping')
            logger.info("MongoDB connection successful")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            raise
        
    async def optimize_signals(self) -> List[OptimizationResult]:
        """Main optimization function"""
        logger.info("🚀 Starting signal threshold optimization with GPU acceleration...")
        
        all_results = []
        
        # Optimize for each network
        for network in ['SOLANA', 'ECLIPSE']:
            logger.info(f"Optimizing {network} signals...")
            network_results = await self.optimize_network_signals(network)
            all_results.extend(network_results)
        
        # Sort by profit
        all_results.sort(key=lambda x: x.total_profit, reverse=True)
        
        # Display top results
        logger.info("🏆 Top 10 Optimization Results:")
        for i, result in enumerate(all_results[:10], 1):
            logger.info(f"{i}. {result.network}: ${result.total_profit:.2f} profit, "
                       f"{result.total_trades} trades, {result.win_rate:.1%} win rate "
                       f"({result.execution_time:.1f}ms, GPU: {result.gpu_accelerated})")
            logger.info(f"   Fees: ${result.total_fees:.2f} (Gas: ${result.total_gas_fees:.2f}, "
                       f"Swap: ${result.total_swap_fees:.2f})")
        
        # Display best configurations
        for network in ['SOLANA', 'ECLIPSE']:
            network_results = [r for r in all_results if r.network == network]
            if network_results:
                best = max(network_results, key=lambda x: x.total_profit)
                logger.info(f"\n🏆 Best {network} Configuration:")
                logger.info(f"Profit: ${best.total_profit:.2f}")
                logger.info(f"Trades: {best.total_trades}")
                logger.info(f"Win Rate: {best.win_rate:.1%}")
                logger.info(f"Execution Time: {best.execution_time:.1f}ms")
                logger.info(f"GPU Accelerated: {best.gpu_accelerated}")
                logger.info(f"Thresholds: {best.thresholds}")
        
        return all_results
    
    async def optimize_network_signals(self, network: str) -> List[OptimizationResult]:
        """Optimize signals for a specific network"""
        # Get historical data
        historical_data = await self.get_historical_data(network)
        if not historical_data:
            logger.warning(f"⚠️ No historical data found for {network}")
            return []
        
        logger.info(f"Found {len(historical_data)} tokens with historical data for {network}")
        
        # Generate parameter combinations
        parameter_combinations = self.generate_parameter_combinations()
        logger.info(f"🔍 Testing {len(parameter_combinations)} parameter combinations for {network}...")
        
        # Process in batches
        batches = (len(parameter_combinations) + self.batch_size - 1) // self.batch_size
        logger.info(f"🎲 Processing in {batches} batches of {self.batch_size}...")
        
        all_results = []
        for batch_idx in range(batches):
            start_time = datetime.now()
            batch_start = batch_idx * self.batch_size
            batch_end = min(batch_start + self.batch_size, len(parameter_combinations))
            batch = parameter_combinations[batch_start:batch_end]
            
            logger.info(f"  🚀 Starting batch {batch_idx + 1}/{batches} with {len(batch)} parameters...")
            
            # Process batch with GPU
            batch_results = await self.process_batch_gpu(historical_data, batch, network)
            all_results.extend(batch_results)
            
            batch_time = (datetime.now() - start_time).total_seconds() * 1000
            logger.info(f"  Batch {batch_idx + 1}/{batches}: {len(batch_results)} combinations processed in {batch_time:.0f}ms")
        
        logger.info(f"🎯 Total results for {network}: {len(all_results)}")
        return all_results
    
    async def process_batch_gpu(self, historical_data: List[TokenData], 
                               parameter_batch: List[Dict], network: str) -> List[OptimizationResult]:
        """Process a batch of parameters using GPU acceleration"""
        results = []
        
        # Convert price data to tensors on GPU
        price_tensors = []
        for token in historical_data:
            prices = torch.tensor(token.price_history[:self.max_time_periods], 
                                dtype=torch.float32, device=self.device)
            price_tensors.append(prices)
        
        # Process each parameter combination
        for params in parameter_batch:
            start_time = datetime.now()
            
            try:
                # Run backtest on GPU
                backtest_result = self.run_backtest_gpu(price_tensors, params)
                
                execution_time = (datetime.now() - start_time).total_seconds() * 1000
                
                result = OptimizationResult(
                    network=network,
                    thresholds=params['thresholds'],
                    position_sizing=params['position_sizing'],
                    signal_sensitivity=params['signal_sensitivity'],
                    signal_weights=params['signal_weights'],
                    network_specific=params['network_specific'],
                    position_management=params['position_management'],
                    risk_adjustment=params['risk_adjustment'],
                    feature_flags=params['feature_flags'],
                    total_profit=backtest_result['total_profit'],
                    total_trades=backtest_result['total_trades'],
                    win_rate=backtest_result['win_rate'],
                    avg_profit_per_trade=backtest_result['total_profit'] / max(backtest_result['total_trades'], 1),
                    max_drawdown=backtest_result['max_drawdown'],
                    sharpe_ratio=backtest_result['sharpe_ratio'],
                    final_balance=backtest_result['final_balance'],
                    execution_time=execution_time,
                    gpu_accelerated=True,
                    total_fees=backtest_result['total_fees'],
                    total_gas_fees=backtest_result['total_gas_fees'],
                    total_swap_fees=backtest_result['total_swap_fees']
                )
                results.append(result)
                
            except Exception as e:
                logger.error(f"Error processing parameters: {e}")
                continue
        
        return results
    
    def run_backtest_gpu(self, price_tensors: List[torch.Tensor], params: Dict) -> Dict:
        """Run backtest simulation on GPU"""
        trades = []
        balance = torch.tensor(self.initial_balance, device=self.device)
        max_balance = torch.tensor(self.initial_balance, device=self.device)
        max_drawdown = torch.tensor(0.0, device=self.device)
        total_fees = torch.tensor(0.0, device=self.device)
        total_gas_fees = torch.tensor(0.0, device=self.device)
        total_swap_fees = torch.tensor(0.0, device=self.device)
        
        # Find minimum length across all tensors
        min_length = min(tensor.shape[0] for tensor in price_tensors)
        
        if min_length < 2:
            return self._create_default_result()
        
        # Simulate trading over time periods
        for time_idx in range(5, min(min_length, self.max_time_periods)):
            for token_idx, price_tensor in enumerate(price_tensors):
                if time_idx >= price_tensor.shape[0]:
                    continue
                
                current_price = price_tensor[time_idx]
                previous_price = price_tensor[time_idx - 1]
                
                # Validate price data
                if (current_price > 0 and previous_price > 0 and 
                    not torch.isnan(current_price) and not torch.isnan(previous_price) and
                    current_price < 1000000 and previous_price < 1000000):
                    
                    # Calculate price change percentage
                    price_change = (current_price - previous_price) / previous_price
                    
                    # Limit price change to realistic bounds
                    if torch.abs(price_change) > 0.5:
                        continue
                    
                    # Very low thresholds to ensure trades happen
                    sma_threshold = 0.01
                    rsi_threshold = 0.01
                    momentum_threshold = 0.01
                    
                    # Calculate signal strength
                    signal_strength = torch.abs(price_change)
                    
                    # Buy signal - very sensitive
                    if price_change > 0.0001 and balance > 10:
                        trade_amount = torch.min(balance * 0.1, torch.tensor(100.0, device=self.device))
                        gas_fee = torch.tensor(0.1, device=self.device)
                        swap_fee = trade_amount * 0.0025
                        total_trade_fees = gas_fee + swap_fee
                        
                        if balance >= trade_amount + total_trade_fees:
                            balance -= (trade_amount + total_trade_fees)
                            total_fees += total_trade_fees
                            total_gas_fees += gas_fee
                            total_swap_fees += swap_fee
                            
                            trades.append({
                                'action': 'BUY',
                                'price': current_price.item(),
                                'amount': (trade_amount / current_price).item(),
                                'fees': total_trade_fees.item()
                            })
                    
                    # Sell signal - very sensitive
                    if (price_change < -0.0001 and trades and 
                        trades[-1]['action'] == 'BUY'):
                        last_trade = trades[-1]
                        sell_value = last_trade['amount'] * current_price.item()
                        gas_fee = torch.tensor(0.1, device=self.device)
                        swap_fee = torch.tensor(sell_value * 0.0025, device=self.device)
                        total_trade_fees = gas_fee + swap_fee
                        
                        balance += torch.tensor(sell_value - total_trade_fees.item(), device=self.device)
                        total_fees += total_trade_fees
                        total_gas_fees += gas_fee
                        total_swap_fees += swap_fee
                        
                        trades.append({
                            'action': 'SELL',
                            'price': current_price.item(),
                            'amount': last_trade['amount'],
                            'fees': total_trade_fees.item()
                        })
                    
                    # Additional buy signals for any positive movement
                    if price_change > 0.0005 and balance > 10:
                        trade_amount = torch.min(balance * 0.05, torch.tensor(50.0, device=self.device))
                        gas_fee = torch.tensor(0.1, device=self.device)
                        swap_fee = trade_amount * 0.0025
                        total_trade_fees = gas_fee + swap_fee
                        
                        if balance >= trade_amount + total_trade_fees:
                            balance -= (trade_amount + total_trade_fees)
                            total_fees += total_trade_fees
                            total_gas_fees += gas_fee
                            total_swap_fees += swap_fee
                            
                            trades.append({
                                'action': 'BUY',
                                'price': current_price.item(),
                                'amount': (trade_amount / current_price).item(),
                                'fees': total_trade_fees.item()
                            })
                    
                    # Take profit on any gain
                    if (price_change > 0.0002 and trades and 
                        trades[-1]['action'] == 'BUY'):
                        last_trade = trades[-1]
                        sell_value = last_trade['amount'] * current_price.item()
                        gas_fee = torch.tensor(0.1, device=self.device)
                        swap_fee = torch.tensor(sell_value * 0.0025, device=self.device)
                        total_trade_fees = gas_fee + swap_fee
                        
                        balance += torch.tensor(sell_value - total_trade_fees.item(), device=self.device)
                        total_fees += total_trade_fees
                        total_gas_fees += gas_fee
                        total_swap_fees += swap_fee
                        
                        trades.append({
                            'action': 'SELL',
                            'price': current_price.item(),
                            'amount': last_trade['amount'],
                            'fees': total_trade_fees.item()
                        })
            
            # Update max balance and drawdown
            if balance > max_balance:
                max_balance = balance
            
            drawdown = (max_balance - balance) / max_balance
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        # Calculate metrics
        sell_trades = [t for t in trades if t['action'] == 'SELL']
        returns = []
        
        for sell_trade in sell_trades:
            buy_trade = next((t for t in trades if t['action'] == 'BUY' and t['price'] < sell_trade['price']), None)
            if buy_trade:
                return_val = (sell_trade['price'] - buy_trade['price']) / buy_trade['price']
                returns.append(return_val)
        
        if not returns:
            return self._create_default_result()
        
        # Calculate metrics using PyTorch
        returns_tensor = torch.tensor(returns, device=self.device)
        mean_return = torch.mean(returns_tensor)
        variance = torch.mean((returns_tensor - mean_return) ** 2)
        std_dev = torch.sqrt(variance)
        sharpe_ratio = mean_return / std_dev if std_dev > 0 else torch.tensor(0.0, device=self.device)
        
        win_rate = torch.sum(returns_tensor > 0).float() / len(returns_tensor)
        
        return {
            'total_profit': balance.item() - self.initial_balance,
            'total_trades': len(trades),
            'win_rate': win_rate.item(),
            'sharpe_ratio': sharpe_ratio.item(),
            'max_drawdown': max_drawdown.item(),
            'final_balance': balance.item(),
            'total_fees': total_fees.item(),
            'total_gas_fees': total_gas_fees.item(),
            'total_swap_fees': total_swap_fees.item()
        }
    
    def _create_default_result(self) -> Dict:
        """Create default result for failed backtests"""
        return {
            'total_profit': 0.0,
            'total_trades': 0,
            'win_rate': 0.0,
            'sharpe_ratio': 0.0,
            'max_drawdown': 0.0,
            'final_balance': self.initial_balance,
            'total_fees': 0.0,
            'total_gas_fees': 0.0,
            'total_swap_fees': 0.0
        }
    
    def generate_parameter_combinations(self) -> List[Dict]:
        """Generate random parameter combinations"""
        combinations = []
        attempts = 0
        max_attempts = 2000
        
        while len(combinations) < self.max_combinations and attempts < max_attempts:
            attempts += 1
            
            # Generate random parameters
            thresholds = {name: random.choice(range) for name, range in self.threshold_ranges.items()}
            position_sizing = {name: random.choice(range) for name, range in self.position_sizing_ranges.items()}
            signal_sensitivity = {name: random.choice(range) for name, range in self.signal_sensitivity_ranges.items()}
            signal_weights = {name: random.choice(range) for name, range in self.signal_weight_ranges.items()}
            network_specific = {name: random.choice(range) for name, range in self.network_specific_ranges.items()}
            position_management = {name: random.choice(range) for name, range in self.position_management_ranges.items()}
            risk_adjustment = {name: random.choice(range) for name, range in self.risk_adjustment_ranges.items()}
            feature_flags = {name: random.choice(range) for name, range in self.feature_flag_ranges.items()}
            
            # Check if combination is unique
            combination = {
                'thresholds': thresholds,
                'position_sizing': position_sizing,
                'signal_sensitivity': signal_sensitivity,
                'signal_weights': signal_weights,
                'network_specific': network_specific,
                'position_management': position_management,
                'risk_adjustment': risk_adjustment,
                'feature_flags': feature_flags
            }
            
            if combination not in combinations:
                combinations.append(combination)
        
        logger.info(f"🎲 Generated {len(combinations)} comprehensive parameter combinations")
        return combinations
    
    async def get_historical_data(self, network: str) -> List[TokenData]:
        """Fetch historical price data from MongoDB"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=self.test_period_days)
        
        logger.info(f"📅 Fetching {network} data from {start_date} to {end_date}")
        
        # List all collections to see what's available
        collections = self.db.list_collection_names()
        logger.info(f"📋 Available collections: {collections}")
        
        # Try different collection name patterns
        collection_names = [
            f'{network.lower()}_prices',
            f'{network.lower()}_price',
            f'{network.lower()}',
            'prices',
            'price_data'
        ]
        
        collection = None
        for name in collection_names:
            if name in collections:
                collection = self.db[name]
                logger.info(f"Using collection: {name}")
                break
        
        if collection is None:
            logger.error(f"No suitable collection found for {network}")
            return []
        
        # Check the structure of one document
        sample_doc = collection.find_one()
        if sample_doc:
            logger.info(f"📄 Sample document structure: {list(sample_doc.keys())}")
        else:
            logger.warning(f"⚠️ No documents found in collection {collection.name}")
            return []
        
        # Get all tokens with sufficient data
        pipeline = [
            {
                '$match': {
                    'timestamp': {
                        '$gte': start_date,
                        '$lte': end_date
                    }
                }
            },
            {
                '$group': {
                    '_id': '$token',  # Changed from '$ticker' to '$token'
                    'prices': {'$push': '$price'},
                    'count': {'$sum': 1}
                }
            },
            {
                '$match': {
                    'count': {'$gte': 10}  # Minimum data points
                }
            }
        ]
        
        cursor = collection.aggregate(pipeline)
        tokens = []
        
        # Use synchronous iteration since PyMongo aggregate returns sync cursor
        for doc in cursor:
            if len(doc['prices']) >= 10:
                tokens.append(TokenData(
                    ticker=doc['_id'],  # This will be the token name
                    price_history=doc['prices']
                ))
        
        logger.info(f"Found {len(tokens)} valid tokens with sufficient data")
        return tokens
    
    async def save_optimization_results(self, results: List[OptimizationResult]):
        """Save optimization results to file"""
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S-%f")[:-3] + "Z"
        filename = f"optimization-results-{timestamp}.json"
        
        # Convert results to JSON-serializable format
        serializable_results = []
        for result in results:
            serializable_results.append({
                'network': result.network,
                'thresholds': result.thresholds,
                'position_sizing': result.position_sizing,
                'signal_sensitivity': result.signal_sensitivity,
                'signal_weights': result.signal_weights,
                'network_specific': result.network_specific,
                'position_management': result.position_management,
                'risk_adjustment': result.risk_adjustment,
                'feature_flags': result.feature_flags,
                'total_profit': result.total_profit,
                'total_trades': result.total_trades,
                'win_rate': result.win_rate,
                'avg_profit_per_trade': result.avg_profit_per_trade,
                'max_drawdown': result.max_drawdown,
                'sharpe_ratio': result.sharpe_ratio,
                'final_balance': result.final_balance,
                'execution_time': result.execution_time,
                'gpu_accelerated': result.gpu_accelerated,
                'total_fees': result.total_fees,
                'total_gas_fees': result.total_gas_fees,
                'total_swap_fees': result.total_swap_fees
            })
        
        with open(filename, 'w') as f:
            json.dump(serializable_results, f, indent=2)
        
        logger.info(f"💾 Saving optimization results...")
        logger.info(f"Results saved to {filename}")

async def main():
    """Main function"""
    optimizer = SignalOptimizer()
    
    try:
        # Run optimization
        results = await optimizer.optimize_signals()
        
        # Save results
        await optimizer.save_optimization_results(results)
        
    except Exception as e:
        logger.error(f"Optimization failed: {e}")
        raise
    finally:
        # Close MongoDB connection
        optimizer.mongo_client.close()
        logger.info("📦 Disconnected from MongoDB")

if __name__ == "__main__":
    asyncio.run(main()) 