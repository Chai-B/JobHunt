import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from app.services.spiders import scrape_jobs_headless

async def main():
    url = "https://boards.greenhouse.io/stripe"
    print(f"Testing headless scrape on {url}...")
    jobs = await scrape_jobs_headless(url)
    print(f"\n✅ Scraped {len(jobs)} jobs!")
    for j in jobs[:5]:
        print(f" - {j['title']} @ {j['company']} ({j['location']})")
        print(f"   Desc: {j['description'][:100]}...\n")

if __name__ == "__main__":
    asyncio.run(main())
