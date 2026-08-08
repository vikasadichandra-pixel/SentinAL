"""
SentinAL — AI Judge Seeding Script (Bounty Demo Data)

Safely populates 5 distinct demo Violation cases spanning all risk levels,
statuses, and investigation labels using get_or_create for idempotency.

Usage:
    python seed_bounty_demo.py

Safe to run multiple times — will not create duplicate entries.
"""
import os
import sys
import django
from datetime import datetime

# ── Django Bootstrap ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "SentinAL_Backend")
sys.path.append(BACKEND_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sentinal_core.settings')
django.setup()

from api.models import Violation


DEMO_CASES = [
    {
        "asset_name": "The Tomorrow War 2",
        "url": "https://piratestream.fake/the-tomorrow-war-2-full",
        "location": "RU",
        "html_hash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd",
        "breach_type": "PRE_RELEASE",
        "status": "OPEN",
        "investigation_label": "SUSPECTED",
        "investigator_notes": "Pre-release content detected on Russian streaming site. Awaiting hash verification.",
    },
    {
        "asset_name": "Red Notice",
        "url": "https://moviez-free.fake/red-notice-2021-hd",
        "location": "JP",
        "html_hash": "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcde",
        "breach_type": "TERRITORY",
        "status": "OPEN",
        "investigation_label": "NEEDS_REVIEW",
        "investigator_notes": "Content served from Japan — outside licensed US territory. Needs manual review.",
    },
    {
        "asset_name": "Prey",
        "url": "https://stream-pirate.fake/prey-2022-watch",
        "location": "IN",
        "html_hash": "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdef",
        "breach_type": "PIRACY",
        "status": "ENFORCED",
        "investigation_label": "VERIFIED",
        "investigator_notes": "Confirmed unauthorized distribution. DMCA takedown notice dispatched.",
    },
    {
        "asset_name": "The Tomorrow War 2",
        "url": "https://leakflix.fake/tomorrow-war-2-cam",
        "location": "BR",
        "html_hash": "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdefab",
        "breach_type": "PRE_RELEASE",
        "status": "RESOLVED",
        "investigation_label": "VERIFIED",
        "investigator_notes": "CAM-quality leak from Brazil. Source identified and resolved.",
    },
    {
        "asset_name": "Red Notice",
        "url": "https://freedownloads.fake/red-notice-dvdrip",
        "location": "DE",
        "html_hash": "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcdefabcd",
        "breach_type": "PIRACY",
        "status": "OPEN",
        "investigation_label": None,
        "investigator_notes": "",
    },
]


def seed_bounty_demo():
    print("\n" + "=" * 65)
    print(" SENTINAL BOUNTY DEMO -- SEEDING 5 DEMO CASES")
    print("=" * 65 + "\n")

    created_count = 0
    skipped_count = 0

    for i, case in enumerate(DEMO_CASES, start=1):
        # Use url + breach_type as the unique lookup key
        # (same URL with same breach type = same case)
        obj, created = Violation.objects.get_or_create(
            url=case["url"],
            breach_type=case["breach_type"],
            defaults={
                "asset_name": case["asset_name"],
                "location": case["location"],
                "html_hash": case["html_hash"],
                "status": case["status"],
                "investigation_label": case["investigation_label"],
                "investigator_notes": case["investigator_notes"],
            }
        )

        status_icon = "+" if created else "="
        action = "CREATED" if created else "SKIPPED (already exists)"

        print(f"  [{status_icon}] Case {i}/5: {case['asset_name']}")
        print(f"      Breach: {case['breach_type']} | Status: {case['status']} | Label: {case['investigation_label'] or 'None'}")
        print(f"      URL: {case['url']}")
        print(f"      -> {action} (ID: {obj.id})\n")

        if created:
            created_count += 1
        else:
            skipped_count += 1

    print("=" * 65)
    print(f" DONE — Created: {created_count} | Skipped: {skipped_count}")
    print("=" * 65 + "\n")

    # Summary for AI Judge
    print("Risk Level Coverage:")
    print(f"  HIGH (PRE_RELEASE): {Violation.objects.filter(breach_type='PRE_RELEASE').count()} cases")
    print(f"  MEDIUM (PIRACY):    {Violation.objects.filter(breach_type='PIRACY').count()} cases")
    print(f"  LOW (TERRITORY):    {Violation.objects.filter(breach_type='TERRITORY').count()} cases")
    print()
    print("Status Coverage:")
    print(f"  OPEN:     {Violation.objects.filter(status='OPEN').count()} cases")
    print(f"  RESOLVED: {Violation.objects.filter(status='RESOLVED').count()} cases")
    print(f"  ENFORCED: {Violation.objects.filter(status='ENFORCED').count()} cases")
    print()


if __name__ == "__main__":
    seed_bounty_demo()
