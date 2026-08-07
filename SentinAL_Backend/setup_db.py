import os
import django
from datetime import date

# Initialize Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinal_core.settings')
django.setup()

from api.models import Contract, Territory

# 1. Setup Territories
us, _ = Territory.objects.get_or_create(code="US", name="United States")
jp, _ = Territory.objects.get_or_create(code="JP", name="Japan")

# 2. Add Red Notice (US Only - so RU triggers Territory Breach)
c1, _ = Contract.objects.get_or_create(
    title="Red Notice", 
    defaults={"official_runtime": 118, "release_date": date(2021,11,12), "expiry_date": date(2030,12,31)}
)
c1.allowed_territories.set([us])

# 3. Add The Tomorrow War 2 (Release date 2028 - so it triggers Pre-Release Breach)
c2, _ = Contract.objects.get_or_create(
    title="The Tomorrow War 2", 
    defaults={"official_runtime": 138, "release_date": date(2028,7,1), "expiry_date": date(2035,12,31)}
)
c2.allowed_territories.set([us, jp])

# 4. Add Prey (License expired in 2024 - so it triggers Expired Piracy Breach)
c3, _ = Contract.objects.get_or_create(
    title="Prey", 
    defaults={"official_runtime": 100, "release_date": date(2022,8,5), "expiry_date": date(2024,1,1)}
)
c3.allowed_territories.set([us])

print("[+] SUCCESS: 3 Contracts loaded into SentinAL Database!")