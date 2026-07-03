#!/usr/bin/env python3
"""
Nitter scraper for crypto/DePIN monitoring.
Integrates nitter_scraper library to fetch relevant tweets from target accounts.
"""

import os
import sys
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Try importing nitter_scraper
try:
    from nitter_scraper import get_tweets, get_profile
except ImportError:
    print("Error: nitter_scraper not installed. Run: pip install nitter_scraper")
    sys.exit(1)

# Target accounts to monitor (from config)
TARGET_ACCOUNTS = [
    # DePIN Projects
    "dawninternet",
    "helium",
    "GlowFND",
    "grass",
    "FogoChain",
    "daylightenergy_",
    "jito_sol",
    "pipenetwork",
    "DoubleZero",
    "TapeDrive_io",
    "Hivemapper",
    "GEODNET",

    # Funds/VCs
    "EV3ventures",

    # People
    "santiagoroel",
    "Melt_Dem",

    # News sources
    "WatcherGuru",
    "unusual_whales",
    "FirstSquawk",
    "DegenerateNews",
    "tier10k",
    "solidintel_x",
]

# Nitter instances to try (in order of preference)
NITTER_INSTANCES = [
    "nitter.poast.org",      # Primary
    "nitter.fdn.fr",
    "nitter.1d4.us",
    "nitter.kavin.rocks",
    "nitter.net",
    "nitter.privacydev.net",
]


def get_tweets_from_account(username: str, hours_ago: int = 24, max_tweets: int = 20) -> List[Dict[str, Any]]:
    """
    Fetch tweets from a given account using nitter_scraper.
    Retries across different nitter instances if one fails.
    """
    print(f"Fetching tweets from @{username} (last {hours_ago}h)...")

    for i, instance in enumerate(NITTER_INSTANCES):
        try:
            print(f"  Trying instance: {instance}")
            # Use get_tweets function from nitter_scraper
            # It returns a generator, so we iterate and collect
            tweets = []
            for tweet in get_tweets(
                username=username,
                pages=5,  # Get multiple pages
                address=f"https://{instance}"
            ):
                tweets.append(tweet)
                if len(tweets) >= max_tweets:
                    break

            if tweets and len(tweets) > 0:
                print(f"  ✓ Got {len(tweets)} tweets from {instance}")
                return tweets
            else:
                print(f"  ✗ No tweets from {instance}")

        except Exception as e:
            print(f"  ✗ Error with {instance}: {e}")
            continue

    print(f"Failed to fetch tweets from @{username}")
    return []


def filter_recent_tweets(tweets: List[Dict], hours_ago: int) -> List[Dict]:
    """
    Filter tweets to only include those from the last N hours.
    Also filters out replies/retweets if needed.
    """
    cutoff = datetime.now() - timedelta(hours=hours_ago)
    filtered = []

    for tweet in tweets:
        # Parse date - nitter_scraper returns dates as strings
        tweet_date = tweet.get('date', '')
        if tweet_date and tweet_date != 'N/A':
            try:
                # Handle various date formats from nitter
                # Common formats: "Feb 26, 2026", "Feb 26, 2026 · 14:05", "26m", "2h", etc.
                # Simplified: just check if it's recent
                dt = None

                # For relative dates like "26m", "2h", "24h"
                if isinstance(tweet_date, str):
                    if tweet_date.replace('.', '').replace('h', '').replace('m', '').replace('d', '').replace('s', '').isdigit():
                        # Parse relative time
                        num = int(''.join(c for c in tweet_date if c.isdigit()))
                        unit = ''.join(c for c in tweet_date if c in 'hmds')

                        if unit == 's':
                            dt = datetime.now() - timedelta(seconds=num)
                        elif unit == 'm':
                            dt = datetime.now() - timedelta(minutes=num)
                        elif unit == 'h':
                            dt = datetime.now() - timedelta(hours=num)
                        elif unit == 'd':
                            dt = datetime.now() - timedelta(days=num)
                    else:
                        # Try absolute date parsing
                        # "Feb 26, 2026" or "Feb 26, 2026 · 14:05"
                        date_str = tweet_date.split('·')[0].strip() if '·' in tweet_date else tweet_date
                        dt = datetime.strptime(date_str, "%b %d, %Y")

                    if dt and dt > cutoff:
                        filtered.append(tweet)

            except Exception as e:
                print(f"    Date parse error: {e}")
                # If we can't parse the date, include it anyway for now
                filtered.append(tweet)

    print(f"Filtered to {len(filtered)} recent tweets (last {hours_ago}h)")
    return filtered


def save_results(results: Dict[str, List[Dict]], filename: str):
    """Save results to JSON file for review."""
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"Saved results to {filename}")


def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("Usage: python3 nitter-monitor.py [username] [hours_ago] [max_tweets]")
        print("  Example: python3 nitter-monitor.py Helium 24 10")
        sys.exit(1)

    username = sys.argv[1]
    hours_ago = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    max_tweets = int(sys.argv[3]) if len(sys.argv) > 3 else 20

    print(f"\n{'='*60}")
    print(f"Target: @{username}")
    print(f"Time window: Last {hours_ago} hours")
    print(f"Max tweets per account: {max_tweets}")

    # Fetch from all accounts (could make this configurable)
    all_results = {}

    for account in TARGET_ACCOUNTS[:3]:  # Test with first 3 accounts
        print(f"\nFetching from @{account}...")
        tweets = get_tweets_from_account(account, hours_ago, max_tweets)

        if tweets:
            # Filter for recent tweets
            recent_tweets = filter_recent_tweets(tweets, hours_ago)
            if recent_tweets:
                all_results[account] = recent_tweets

    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    # External tooling workspace (defaults to ~/.openclaw/workspace; override with OPENCLAW_WORKSPACE)
    workspace_dir = os.environ.get(
        "OPENCLAW_WORKSPACE", os.path.join(os.path.expanduser("~"), ".openclaw", "workspace")
    )
    output_file = os.path.join(workspace_dir, "data", f"tweets_{timestamp}.json")
    save_results(all_results, output_file)

    # Summary
    total_tweets = sum(len(tweets) for tweets in all_results.values())
    print(f"\n{'='*60}")
    print(f"Total tweets collected: {total_tweets}")
    print(f"Results saved to: {output_file}")

    # Print sample tweets for review
    print(f"\n{'='*60}")
    print("Sample tweets (for review):")
    for account, tweets in list(all_results.items())[:2]:
        if tweets:
            print(f"\n@{account} ({len(tweets)} tweets):")
            for tweet in tweets[:2]:  # Show first 2
                tweet_text = tweet.get('text', tweet.get('content', '[No text]'))
                tweet_date = tweet.get('date', 'Unknown date')
                print(f"  [{tweet_date}] {tweet_text[:100]}...")


if __name__ == "__main__":
    main()
