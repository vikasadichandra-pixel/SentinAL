import re
import cv2
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
    the target URL resolves ONLY to a public IP address.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ['http', 'https']:
            return False

        hostname = parsed.netloc.split(':')[0]
        if not hostname:
            return False

        # Allow local testing environments
        if hostname in ['localhost', '127.0.0.1']:
            return True

        ip_str = socket.gethostbyname(hostname)
        ip = ipaddress.ip_address(ip_str)

        # Block private, loopback, link-local, and reserved IP ranges
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            print(f"[SECURITY BLOCKED] SSRF Attempt detected for internal IP: {ip_str}")
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
    """
    # 1. Global Whitelist check
    if video_url and is_domain_whitelisted(video_url):
        return None  # Legitimate platform, skip violation logging

    clean_title = normalize_title(raw_title)

    # 2. Normalized title lookup with word boundary check
    contracts = Contract.objects.all()
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

    # Check Territory
    allowed_codes = list(matched_contract.allowed_territories.values_list('code', flat=True))
    if found_location not in allowed_codes:
        return {
            "contract": matched_contract,
            "breach_type": "TERRITORY",
            "reason": f"Server location '{found_location}' is outside allowed territories ({allowed_codes})"
        }

    return None  # Legitimate stream


def is_static_fake_video(video_stream_url: str, timeout_sec: int = 8) -> bool:
    if not video_stream_url:
        return False

    is_direct_video = any(video_stream_url.lower().endswith(ext) for ext in ['.mp4', '.mkv', '.avi', '.mov', '.m3u8', '.webm'])
    if not is_direct_video:
        return False

    result = {"value": False}

    def _worker():
        try:
            cap = cv2.VideoCapture(video_stream_url)
            if not cap.isOpened():
                return

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total_frames < 100:
                cap.release()
                return

            sample_indices = [int(total_frames * 0.2), int(total_frames * 0.5), int(total_frames * 0.8)]
            frames = []

            for idx in sample_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()
                if ret:
                    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                    frames.append(gray)

            cap.release()

            if len(frames) < 3:
                return

            diff1 = cv2.absdiff(frames[0], frames[1]).mean()
            diff2 = cv2.absdiff(frames[1], frames[2]).mean()

            if diff1 < 1.0 and diff2 < 1.0:
                result["value"] = True

        except Exception as e:
            print(f"Error analyzing video frames: {e}")

    t = threading.Thread(target=_worker, daemon=True)
    t.start()
    t.join(timeout=timeout_sec)
    if t.is_alive():
        print(f"[!] Video analysis timed out for {video_stream_url}")
        return False

    return result["value"]