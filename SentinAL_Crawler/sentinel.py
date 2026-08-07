import sys
import time
import json
import hashlib
import requests
import socket
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import os
from dotenv import load_dotenv

from pathlib import Path
# Dynamically locate the .env file inside SentinAL_Backend
env_path = Path(__file__).resolve().parent.parent / "SentinAL_Backend" / ".env"
load_dotenv(dotenv_path=env_path)

API_TOKEN = os.getenv("SENTINAL_API_TOKEN")
HEADERS = {"Authorization": f"Token {API_TOKEN}"}

API_ENDPOINT = "http://127.0.0.1:8000/api/report/"

def calculate_hash(content: str) -> str:
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def get_stable_fingerprint(page_source: str) -> str:
    soup = BeautifulSoup(page_source, 'html.parser')
    for element in soup(["script", "style", "iframe", "footer", "nav", "aside"]):
        element.extract()
    return soup.get_text(strip=True)

def resolve_real_server_location(url: str) -> str:
    """Resolves URL domain to an IP address and gets the true country code."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.split(':')[0]
        
        if domain in ['localhost', '127.0.0.1', '']:
            return "IN"  # Default fallback for local testing
            
        ip_address = socket.gethostbyname(domain)
        geo_res = requests.get(f"http://ip-api.com/json/{ip_address}", timeout=3).json()
        
        if geo_res.get("status") == "success":
            return geo_res.get("countryCode", "XX")
    except Exception as e:
        print(f"[!] Geolocation lookup warning: {e}")
    return "XX"

def run_crawler(target_url):
    print(f"[*] Sentinel Crawler Activated. Target: {target_url}")

    chrome_options = Options()
    chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--log-level=3")
    
    driver = webdriver.Chrome(options=chrome_options)

    try:
        driver.get(target_url)
        time.sleep(1)
        
        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')

        title = soup.title.string if soup.title else "Unknown Asset"
        
        meta_uploader = soup.find("meta", attrs={"name": "uploader"})
        uploader = meta_uploader["content"] if meta_uploader else "Unknown"

        # 1. Look for the mocked HTML meta tag first (for local testing: RU, JP, US)
        meta_loc_tag = soup.find("meta", attrs={"name": "server_location"})
        meta_location = meta_loc_tag["content"] if meta_loc_tag else None

        # 2. Get the real IP location (will return "IN" for localhost)
        real_location = resolve_real_server_location(target_url)
        
        # 3. Prioritize the mocked HTML tag if it exists
        final_location = meta_location if meta_location else real_location
        
        meta_duration = soup.find("meta", attrs={"name": "duration"})
        duration = int(meta_duration["content"]) if meta_duration else 0

        html_hash = calculate_hash(get_stable_fingerprint(page_source))

        print(f"[+] TARGET ACQUIRED: {title}")
        print(f"[+] SERVER LOCATION: {final_location}")
        print(f"[+] DURATION: {duration} mins")
        print(f"[+] EVIDENCE HASH: {html_hash[:10]}...")

        payload = {
            "scraped_data": {
                "page_title": title,
                "url": target_url,
                "uploader_name": uploader,
                "server_location_code": final_location,  # Use the merged variable here
                "video_duration_minutes": duration,
                "html_hash": html_hash
            }
        }

        response = requests.post(API_ENDPOINT, json=payload, headers=HEADERS)
        
        if response.status_code == 201:
            print(f"[+] SUCCESS: Evidence Package Uploaded (HTTP 201)")
        else:
            print(f"[-] FAILED: Backend rejected report. Status: {response.status_code}")
            print(response.text)

    except Exception as e:
        print(f"[-] CRITICAL FAILURE: {e}")

    finally:
        driver.quit()

if __name__ == "__main__":
    # Check if a URL was passed via the command line
    if len(sys.argv) > 1:
        dynamic_url = sys.argv[1]
    else:
        # Fallback for quick local testing if no URL is provided
        dynamic_url = "http://127.0.0.1:8080/pirate-site.html"
        
    run_crawler(dynamic_url)