import requests
import json
import os
from dotenv import load_dotenv

# 1. Load the secret token from your .env file
load_dotenv()
API_TOKEN = os.getenv("SENTINAL_API_TOKEN")
HEADERS = {"Authorization": f"Token {API_TOKEN}"}

# The Target Endpoint
url = "http://127.0.0.1:8000/api/report/"

# The Malicious Payload
payload = {
    "scraped_data": {
        "url": "http://123movies.to/avengers-leaked",
        "page_title": "Avengers: Endgame Full Movie HD Free",
        "video_duration_minutes": 180,  # Updated to minutes so the engine knows it's a full movie
        "uploader_name": "PirateKing99",
        "upload_date": "2026-01-28",
        "server_location_code": "RU",   # Triggers the Territory Breach
        "detected_keywords": ["leaked", "free stream"],
        "html_hash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e"
    }
}

print(f"[*] Launching Attack on {url}...")

try:
    # 2. Pass the HEADERS to successfully authenticate
    response = requests.post(url, json=payload, headers=HEADERS)
    
    # Check the result
    if response.status_code == 201:
        print("\n[+] Violation Logged.")
        print("Server Response:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"\n[-] FAILED. Status Code: {response.status_code}")
        print("Error Details:")
        print(response.text)

except Exception as e:
    print(f"\n[!] CONNECTION ERROR: {e}")
    print("Make sure the Django server is running (python manage.py runserver)")