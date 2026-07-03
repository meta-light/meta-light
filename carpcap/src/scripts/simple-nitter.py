#!/usr/bin/env python3
import sys
import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
from fake_useragent import UserAgent

NITTER_INSTANCES = [
    "https://nitter.poast.org",
    "https://nitter.moomoo.me",
    "https://nitter.it",
    "https://nitter.privacydev.net",
    "https://nitter.net"
]

def get_tweets(username, max_tweets=10):
    ua = UserAgent()
    
    for instance in NITTER_INSTANCES:
        try:
            url = f"{instance}/{username}"
            headers = {"User-Agent": ua.random}
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code != 200:
                continue
                
            soup = BeautifulSoup(response.text, 'html.parser')
            items = soup.find_all('div', class_='timeline-item')
            
            tweets = []
            for item in items:
                if len(tweets) >= max_tweets:
                    break
                    
                content = item.find('div', class_='tweet-content')
                date = item.find('span', class_='tweet-date')
                link = item.find('a', class_='tweet-link')
                
                if content:
                    tweet_url = link['href'] if link else ""
                    if tweet_url and not tweet_url.startswith('http'):
                        tweet_url = f"https://x.com{tweet_url.replace('#m', '')}"
                    
                    tweets.append({
                        "text": content.get_text(strip=True),
                        "date": date.get_text(strip=True) if date else "",
                        "url": tweet_url
                    })
            
            if tweets:
                return {"instance": instance, "tweets": tweets}
                
        except Exception as e:
            continue
            
    return {"error": "Failed to fetch tweets from all instances"}

if __name__ == "__main__":
    user = sys.argv[1] if len(sys.argv) > 1 else "Helium"
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    print(json.dumps(get_tweets(user, count), indent=2))
