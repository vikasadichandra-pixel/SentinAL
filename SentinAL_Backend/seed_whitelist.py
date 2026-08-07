import os
import django

# Setup Django environment so we can use the models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinal_core.settings')
django.setup()

from api.models import WhitelistedDomain

# The Master List of Legitimate Streaming Platforms
SAFE_SITES = [
    # Global Giants
    {"domain": "netflix.com", "name": "Netflix"},
    {"domain": "primevideo.com", "name": "Amazon Prime Video"},
    {"domain": "amazon.com", "name": "Amazon Video"},
    {"domain": "disneyplus.com", "name": "Disney+"},
    {"domain": "apple.com", "name": "Apple TV+"},
    {"domain": "youtube.com", "name": "YouTube Movies & TV"},
    {"domain": "crunchyroll.com", "name": "Crunchyroll"},
    
    # Major US Networks & Platforms
    {"domain": "hulu.com", "name": "Hulu"},
    {"domain": "max.com", "name": "Max (HBO)"},
    {"domain": "peacocktv.com", "name": "Peacock"},
    {"domain": "paramountplus.com", "name": "Paramount+"},
    {"domain": "tubitv.com", "name": "Tubi"},
    {"domain": "vudu.com", "name": "Fandango at Home"},
    {"domain": "plutotv.com", "name": "Pluto TV"},
    
    # Major Indian / Regional Platforms
    {"domain": "hotstar.com", "name": "Disney+ Hotstar"},
    {"domain": "jiocinema.com", "name": "JioCinema"},
    {"domain": "sonyliv.com", "name": "SonyLIV"},
    {"domain": "zee5.com", "name": "ZEE5"},
    {"domain": "mxplayer.in", "name": "MX Player"},
    
    # European / UK Platforms
    {"domain": "bbc.co.uk", "name": "BBC iPlayer"},
    {"domain": "itv.com", "name": "ITVX"},
    {"domain": "channel4.com", "name": "Channel 4"}
]

print("[*] Initializing SentinAL Whitelist Protocol...")

added_count = 0
for site in SAFE_SITES:
    # get_or_create prevents duplicates if you run this multiple times
    obj, created = WhitelistedDomain.objects.get_or_create(
        domain=site["domain"],
        defaults={'platform_name': site["name"]}
    )
    if created:
        print(f"  [+] Added: {site['name']} ({site['domain']})")
        added_count += 1
    else:
        print(f"  [-] Already exists: {site['name']}")

print(f"\n[*] Complete! Added {added_count} new safe domains to the database.")