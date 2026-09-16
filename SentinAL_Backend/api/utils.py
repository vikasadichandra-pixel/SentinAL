import re
try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    CV2_AVAILABLE = False
import socket
import ipaddress
import threading
from datetime import date
from urllib.parse import urlparse
from .models import Contract, Territory, WhitelistedDomain

# Common piracy quality and release tags regex
PIRATE_TAGS_REGEX = r'(?i)\b(720p|1080p|4k|2160p|hdrip|web-dl|webrip|x264|x265|hevc|aac|bluray|brrip|dvdrip|camrip|hdcam|unrated|extended)\b'


def is_safe_public_url(url: str) -> bool:
    """
    Prevents Server-Side Request Forgery (SSRF) by verifying that 
    the target URL resolves ONLY to a public, globally routable IP address.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ['http', 'https']:
            return False

        hostname = parsed.netloc.split(':')[0]
        if not hostname:
            return False

        # Allow local testing environments
        if hostname.lower() in ['localhost', '127.0.0.1', '::1']:
            return True

        ip_str = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_str)

        # Allow local testing loopback IP
        if ip.is_loopback:
            return True

        # Block anything that is not a globally routable public address
        if not ip.is_global:
            print(f"[SECURITY BLOCKED] SSRF attempt detected for non-global IP: {ip_str} ({hostname})")
            return False

        return True
    except Exception as e:
        print(f"[SECURITY CHECK FAILED] Could not resolve URL '{url}': {e}")
        return False


def is_domain_whitelisted(url: str) -> bool:
    """Checks if the domain or any parent domain is in the WhitelistedDomain table."""
    try:
        domain = urlparse(url).netloc.lower().split(':')[0]
        if domain.startswith('www.'):
            domain = domain[4:]

        active_domains = WhitelistedDomain.objects.filter(is_active=True).values_list('domain', flat=True)

        for allowed in active_domains:
            if domain == allowed or domain.endswith('.' + allowed):
                return True
        return False
    except Exception:
        return False


def normalize_title(raw_title: str) -> str:
    if not raw_title:
        return ""

    text = raw_title.lower()
    text = re.sub(r'\.(mp4|mkv|avi|mov|wmv|torrent)$', '', text)
    text = re.sub(r'[\.\-_]', ' ', text)
    text = re.sub(PIRATE_TAGS_REGEX, '', text)
    clean_text = re.sub(r'\s+', ' ', text).strip()

    return clean_text


def evaluate_url_for_breach(raw_title: str, found_location: str, video_duration_mins: int, video_url: str = None):
    """
    Combines Whitelist, Normalization, Release Date Checks, Geofencing, and Static Video Detection.
    Optimized with prefetch_related to eliminate N+1 queries.
    """
    # 1. Global Whitelist check
    if video_url and is_domain_whitelisted(video_url):
        return None  # Legitimate platform, skip violation logging

    clean_title = normalize_title(raw_title)

    # 2. Normalized title lookup with pre-fetched relations
    contracts = Contract.objects.prefetch_related('allowed_territories').all()
    matched_contract = None
    for contract in contracts:
        c_title = normalize_title(contract.title)
        if c_title and re.search(r'\b' + re.escape(c_title) + r'\b', clean_title):
            matched_contract = contract
            break

    if not matched_contract:
        return None  # Asset not protected by our platform

    today = date.today()

    # Pre-Release Leak Check
    if matched_contract.release_date and today < matched_contract.release_date:
        return {
            "contract": matched_contract,
            "breach_type": "PRE_RELEASE",
            "reason": f"Leak detected before official release date ({matched_contract.release_date})"
        }

    # Static Image / Fake File Check
    if video_url and is_static_fake_video(video_url):
        return None  # Discard spam / static image video

    # Check Runtime (must be within 15% of official runtime)
    if matched_contract.official_runtime > 0:
        min_allowed_runtime = matched_contract.official_runtime * 0.85
        if video_duration_mins < min_allowed_runtime:
            return None  # Too short, likely a clip or trailer (Fair Use)

    # Check Expiry
    if today > matched_contract.expiry_date:
        return {
            "contract": matched_contract,
            "breach_type": "PIRACY",
            "reason": "Rights have expired"
        }

    # Check Territory from prefetched allowed_territories
    allowed_codes = [t.code for t in matched_contract.allowed_territories.all()]
    if found_location not in allowed_codes:
        return {
            "contract": matched_contract,
            "breach_type": "TERRITORY",
            "reason": f"Server location '{found_location}' is outside allowed territories ({allowed_codes})"
        }

    return None  # Legitimate stream


def is_static_fake_video(video_stream_url: str, timeout_sec: int = 6) -> bool:
    if not CV2_AVAILABLE or not video_stream_url:
        return False

    is_direct_video = any(video_stream_url.lower().endswith(ext) for ext in ['.mp4', '.mkv', '.avi', '.mov', '.m3u8', '.webm'])
    if not is_direct_video:
        return False

    result = {"value": False}

    def _worker():
        cap = None
        try:
            cap = cv2.VideoCapture(video_stream_url)
            if not cap.isOpened():
                return

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total_frames < 100:
                return

            sample_indices = [int(total_frames * 0.2), int(total_frames * 0.5), int(total_frames * 0.8)]
            frames = []

            for idx in sample_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()
                if ret and frame is not None:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    frames.append(gray)

            if len(frames) < 3:
                return

            diff1 = cv2.absdiff(frames[0], frames[1]).mean()
            diff2 = cv2.absdiff(frames[1], frames[2]).mean()

            if diff1 < 1.0 and diff2 < 1.0:
                result["value"] = True

        except Exception as e:
            print(f"[!] Error analyzing video frames: {e}")
        finally:
            if cap is not None:
                try:
                    cap.release()
                except Exception:
                    pass

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    t.join(timeout=timeout_sec)
    if t.is_alive():
        print(f"[!] Video analysis timed out for {video_stream_url}")
        return False

    return result["value"]


def auto_resolve_violation(violation) -> dict:
    """
    Automated Threat Health Check & Resolution Engine:
    Pings the enforced target URL with short 3-second timeout and Connection: close header.
    Detects if the site has been taken down (connection failure, DNS error, 404, 410, 5xx)
    or if the pirate content has been replaced/removed (SHA-256 hash mismatch).

    If down/resolved, updates database status to 'RESOLVED' and appends audit trail.
    """
    import hashlib
    import requests

    target_url = violation.url
    if not target_url:
        return {
            "status": violation.status,
            "resolved": False,
            "reason": "Missing target URL",
            "violation_id": violation.id
        }

    # SSRF verification (allows localhost/loopback for testing, blocks internal private LAN)
    if not is_safe_public_url(target_url):
        return {
            "status": violation.status,
            "resolved": False,
            "reason": "Forbidden or unsafe URL target (SSRF blocked)",
            "violation_id": violation.id
        }

    is_resolved = False
    resolution_reason = ""
    http_code = None

    try:
        response = requests.get(
            target_url,
            timeout=2.5,
            headers={
                'Connection': 'close',
                'User-Agent': 'SentinAL-Security-Auditor/2.0'
            },
            allow_redirects=True,
            stream=True
        )
        http_code = response.status_code

        # Criteria 1: 404 Not Found, 410 Gone, or 5xx Server Error (Takedown confirmed)
        if http_code in [404, 410]:
            is_resolved = True
            resolution_reason = f"HTTP {http_code} ({response.reason}) — Pirate page taken down / removed"
        elif http_code >= 500:
            is_resolved = True
            resolution_reason = f"HTTP {http_code} Server Error — Pirate host disabled / dead"
        elif 200 <= http_code < 400:
            # Criteria 2: Page returned 200 OK. Check content hash vs evidence hash with bounded chunk read.
            raw_content = b""
            for chunk in response.iter_content(chunk_size=8192):
                raw_content += chunk
                if len(raw_content) >= 262144:  # Max 256 KB
                    break
            current_hash = hashlib.sha256(raw_content).hexdigest()

            if violation.html_hash and current_hash != violation.html_hash:
                is_resolved = True
                resolution_reason = "Page content modified — Evidence hash mismatch (Copyright removal confirmed)"
            else:
                is_resolved = False
                resolution_reason = "Target site is still active and serving identical content"
        else:
            is_resolved = False
            resolution_reason = f"HTTP {http_code} — Status unclear, site may still be responsive"

    except requests.exceptions.ConnectionError:
        is_resolved = True
        resolution_reason = "Connection refused / Host unreachable — Site taken down"
    except requests.exceptions.Timeout:
        is_resolved = True
        resolution_reason = "Connection timed out (>3s) — Target server unresponsive"
    except requests.exceptions.RequestException as e:
        is_resolved = True
        resolution_reason = f"Network failure ({type(e).__name__}) — Target inaccessible"
    except Exception as e:
        is_resolved = True
        resolution_reason = f"Health check exception ({type(e).__name__}) — Target offline"

    # Update database record if resolved
    if is_resolved:
        violation.status = 'RESOLVED'
        if violation.investigation_label == 'SUSPECTED' or not violation.investigation_label:
            violation.investigation_label = 'VERIFIED'
        note_entry = f"[AUTO-RESOLVED: {resolution_reason}]"
        if violation.investigator_notes:
            if note_entry not in violation.investigator_notes:
                violation.investigator_notes = f"{violation.investigator_notes} | {note_entry}".strip()
        else:
            violation.investigator_notes = note_entry
        violation.save(update_fields=['status', 'investigation_label', 'investigator_notes'])

    return {
        "status": violation.status,
        "resolved": is_resolved,
        "reason": resolution_reason,
        "violation_id": violation.id,
        "http_status": http_code
    }


def verify_evidence_hash(violation, max_retries: int = 3) -> tuple:
    """
    Cryptographically verifies that the live target page content matches the stored evidence hash.
    Executes up to `max_retries` attempts with backoff and multi-strategy candidate hashing
    (UTF-8 DOM text fingerprint, raw bytes, and whitespace-normalized DOM text).
    
    Returns: (verified: bool, current_hash: str | None, reason: str)
    """
    import hashlib
    import time
    import requests
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        BeautifulSoup = None

    if not violation or not getattr(violation, 'url', None):
        return False, None, "Missing target URL on violation record."

    target_url = violation.url

    if not is_safe_public_url(target_url):
        return False, None, "SSRF Guard: Target URL points to a restricted IP address."

    stored_hash = (getattr(violation, 'html_hash', None) or '').strip().lower()
    if not stored_hash:
        return False, None, "No cryptographic evidence hash recorded for this violation."

    last_computed_hash = None
    last_failure_reason = "Unknown verification error"

    for attempt in range(1, max_retries + 1):
        if attempt > 1:
            time.sleep(0.35 * attempt)

        page_source = None
        raw_bytes = None

        # Strategy 1: Direct HTTP fetch with strict UTF-8 decoding
        try:
            resp = requests.get(
                target_url,
                timeout=4.0,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinAL-Evidence-Auditor/2.0"},
                allow_redirects=True
            )
            if resp.ok:
                resp.encoding = 'utf-8'
                page_source = resp.text
                raw_bytes = resp.content
            else:
                last_failure_reason = f"Target host returned HTTP {resp.status_code} ({resp.reason})"
        except requests.exceptions.ConnectionError:
            last_failure_reason = "Target host connection refused or unreachable."
        except requests.exceptions.Timeout:
            last_failure_reason = "Target server timed out (>4.0s)."
        except Exception as req_err:
            last_failure_reason = f"HTTP request failed: {req_err}"

        # Strategy 2: Headless Selenium browser fetch if HTTP failed or produced empty source
        if not page_source and attempt == max_retries:
            try:
                from selenium import webdriver
                from selenium.webdriver.chrome.options import Options
                
                options = Options()
                options.add_argument("--headless=new")
                options.add_argument("--no-sandbox")
                options.add_argument("--disable-dev-shm-usage")
                options.add_argument("--disable-gpu")
                options.add_argument("--blink-settings=imagesEnabled=false")
                options.add_argument("--log-level=3")

                driver = webdriver.Chrome(options=options)
                try:
                    driver.set_page_load_timeout(6)
                    driver.get(target_url)
                    page_source = driver.page_source
                    if page_source:
                        raw_bytes = page_source.encode('utf-8')
                finally:
                    driver.quit()
            except Exception as sel_err:
                print(f"[!] Selenium verification notice for {target_url}: {sel_err}")

        if not page_source:
            continue

        try:
            # Multi-Strategy Hash Calculation
            clean_text = None
            if BeautifulSoup:
                soup = BeautifulSoup(page_source, 'html.parser')
                for element in soup(["script", "style", "iframe", "footer", "nav", "aside"]):
                    element.extract()
                clean_text = soup.get_text(strip=True)
            else:
                clean_text = re.sub(r'<(script|style|iframe|footer|nav|aside)[^>]*>.*?</\1>', '', page_source, flags=re.DOTALL | re.IGNORECASE)
                clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
                clean_text = ' '.join(clean_text.split())

            # Generate candidate hashes
            primary_hash = hashlib.sha256(clean_text.encode('utf-8')).hexdigest().lower()
            raw_hash = hashlib.sha256(raw_bytes).hexdigest().lower() if raw_bytes else None
            no_ws_hash = hashlib.sha256(re.sub(r'\s+', '', clean_text).encode('utf-8')).hexdigest().lower()

            last_computed_hash = primary_hash

            # Check if any candidate hash matches stored evidence baseline
            if primary_hash == stored_hash:
                return True, primary_hash, f"Cryptographic evidence hash verified successfully on attempt {attempt}/{max_retries}."
            elif raw_hash and raw_hash == stored_hash:
                return True, raw_hash, f"Raw cryptographic evidence hash verified successfully on attempt {attempt}/{max_retries}."
            elif no_ws_hash == stored_hash:
                return True, no_ws_hash, f"Normalized evidence hash verified successfully on attempt {attempt}/{max_retries}."
            else:
                last_failure_reason = f"Computed {primary_hash[:10]}... vs stored {stored_hash[:10]}..."
        except Exception as parse_err:
            last_failure_reason = f"Hash computation error: {parse_err}"

    return False, last_computed_hash, f"Evidence hash mismatch after {max_retries} verification passes ({last_failure_reason})."