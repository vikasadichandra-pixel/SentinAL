from datetime import date

def check_breach(contract, scraped_location, scraped_duration):
    """
    Returns: 'CLEAN', 'PIRACY', 'TERRITORY', 'PRE_RELEASE', or 'INTEGRITY_VIOLATION'
    """
    today = date.today()

    # 1. Pre-Release Leak Check
    if contract.release_date and today < contract.release_date:
        print(f"   [!] Pre-Release Leak Detected! Release date: {contract.release_date}")
        return "PRE_RELEASE"

    # 2. INTEGRITY CHECK (Runtime difference)
    if scraped_duration > 0 and contract.official_runtime > 0:
        diff = abs(scraped_duration - contract.official_runtime)
        if diff > 5:
            print(f"   [!] Content Manipulation Detected! Diff: {diff} mins")
            return "INTEGRITY_VIOLATION"

    # 3. Expiry Check
    if contract.expiry_date and today > contract.expiry_date:
        return "PIRACY"

    # 4. Territory Check
    allowed_codes = list(contract.allowed_territories.values_list('code', flat=True))
    if scraped_location.upper() not in [c.upper() for c in allowed_codes]:
        return "TERRITORY"

    return "CLEAN"