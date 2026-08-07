import os
import sys
import django
from datetime import date

# 1. Add Backend folder to Python Path dynamically
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "SentinAL_Backend")
sys.path.append(BACKEND_DIR)

# 2. Configure Django Settings Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinal_core.settings')
django.setup()

from api.models import Contract, Territory

def seed_database():
    print("\n" + "=" * 65)
    print(" 📜 SENTINAL ENTERPRISE CONTRACT REGISTRY - DATABASE INITIALIZATION")
    print("=" * 65 + "\n")

    # Territories
    print("[*] Initializing Global Geographic Mapping...")
    us, _ = Territory.objects.get_or_create(code="US", name="United States")
    jp, _ = Territory.objects.get_or_create(code="JP", name="Japan")
    ru, _ = Territory.objects.get_or_create(code="RU", name="Russia")
    print("    [+] ISO Country Codes Provisioned: US, JP, RU\n")

    # Contract 1: Red Notice
    print("[*] Provisioning Contract 1/3: 'Red Notice'")
    c1, _ = Contract.objects.get_or_create(
        title="Red Notice", 
        defaults={
            "official_runtime": 118, 
            "release_date": date(2021, 11, 12), 
            "expiry_date": date(2030, 12, 31)
        }
    )
    c1.allowed_territories.set([us])
    print(f"    ├── Title: {c1.title}")
    print(f"    ├── Allowed Territories: [US]")
    print(f"    └── Rule Constraint: Flag as TERRITORY_BREACH if served from outside [US]\n")

    # Contract 2: The Tomorrow War 2
    print("[*] Provisioning Contract 2/3: 'The Tomorrow War 2'")
    c2, _ = Contract.objects.get_or_create(
        title="The Tomorrow War 2", 
        defaults={
            "official_runtime": 138, 
            "release_date": date(2028, 7, 1), 
            "expiry_date": date(2035, 12, 31)
        }
    )
    c2.allowed_territories.set([us, jp])
    print(f"    ├── Title: {c2.title}")
    print(f"    ├── Official Release Date: 2028-07-01")
    print(f"    └── Rule Constraint: Flag as PRE_RELEASE_LEAK if stream detected before 2028\n")

    # Contract 3: Prey
    print("[*] Provisioning Contract 3/3: 'Prey'")
    c3, _ = Contract.objects.get_or_create(
        title="Prey", 
        defaults={
            "official_runtime": 100, 
            "release_date": date(2022, 8, 5), 
            "expiry_date": date(2024, 1, 1)
        }
    )
    c3.allowed_territories.set([us])
    print(f"    ├── Title: {c3.title}")
    print(f"    ├── License Expiry Date: 2024-01-01")
    print(f"    └── Rule Constraint: Flag as EXPIRED_RIGHTS_PIRACY (Current date past 2024)\n")

    print("=" * 65)
    print(" ✅ ALL CONTRACT RULES LOADED SUCCESSFULLY INTO DATABASE")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    seed_database()