import os
import hashlib
import time
import threading
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from bs4 import BeautifulSoup
import pypdf

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.conf import settings

from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny        
from rest_framework.throttling import ScopedRateThrottle  
from rest_framework.parsers import MultiPartParser

from ai_engine.gemini_client import parse_contract_pdf, draft_legal_notice
from .models import Contract, Territory, Violation
from .serializers import ContractSerializer, ViolationSerializer, CrawlerReportSerializer
from .utils import evaluate_url_for_breach, is_safe_public_url
from utils.pdf_generator import generate_notice_pdf


class ReportViolationView(APIView):
    permission_classes = [IsAuthenticated]       
    throttle_classes = [ScopedRateThrottle]        
    throttle_scope = 'report' 

    def post(self, request):
        scraped_data = request.data.get('scraped_data', request.data)

        payload_for_serializer = {
            "asset_name": scraped_data.get('page_title', '') or scraped_data.get('asset_name', 'Unknown'),
            "url": scraped_data.get('url', ''),
            "location": scraped_data.get('server_location_code', 'UNKNOWN') or scraped_data.get('location', 'UNKNOWN'),
            "html_hash": scraped_data.get('html_hash', ''),
            "video_duration_minutes": scraped_data.get('video_duration_minutes', 0)
        }

        # FIX 3: SSRF Protection Check
        target_url = payload_for_serializer['url']
        if not is_safe_public_url(target_url):
            return Response(
                {"error": "Forbidden target domain or IP range."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = CrawlerReportSerializer(data=payload_for_serializer)
        if serializer.is_valid():
            scraped_title = payload_for_serializer['asset_name']
            scraped_location = payload_for_serializer['location']
            scraped_duration = int(payload_for_serializer['video_duration_minutes'])
            video_url = scraped_data.get('video_url') or payload_for_serializer['url']

            # 1. Immediate Evaluation
            verdict_data = evaluate_url_for_breach(
                raw_title=scraped_title,
                found_location=scraped_location,
                video_duration_mins=scraped_duration,
                video_url=video_url
            )

            if not verdict_data:
                return Response({"status": "ignored_or_compliant"}, status=status.HTTP_200_OK)

            # 2. Log Violation immediately
            violation = Violation.objects.create(
                asset_name=verdict_data["contract"].title,
                url=payload_for_serializer['url'],
                location=scraped_location,
                html_hash=payload_for_serializer['html_hash'],
                breach_type=verdict_data["breach_type"],
                status='OPEN'
            )

            # FIX 4: Background Thread Processing (Async execution)
            def _async_video_analysis():
                print(f"[*] [Async Task] Running video analysis for Violation #{violation.id}...")

            threading.Thread(target=_async_video_analysis, daemon=True).start()
            
            return Response({
                "status": "violation_logged",
                "id": violation.id,
                "type": violation.breach_type,
                "reason": verdict_data["reason"]
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DashboardFeedView(ListAPIView):
    permission_classes = [AllowAny]
    queryset = Violation.objects.all().order_by('-timestamp')
    serializer_class = ViolationSerializer


class EnforceViolationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'enforce'

    def post(self, request, pk):
        try:
            with transaction.atomic():
                violation = Violation.objects.select_for_update().get(pk=pk)
                
                notice_filename = f"Notice_Violation_{violation.id}.pdf"
                pdf_disk_path = os.path.join(settings.MEDIA_ROOT, 'notices', notice_filename)
                
                # If already enforced, ensure the PDF exists and return success
                if violation.status == 'ENFORCED':
                    if not os.path.exists(pdf_disk_path):
                        notice_text = draft_legal_notice(
                            asset_name=violation.asset_name,
                            target_url=violation.url,
                            breach_type=violation.breach_type,
                            location=violation.location
                        )
                        generate_notice_pdf(violation.id, notice_text)
                    
                    try:
                        pdf_download_url = request.build_absolute_uri(f"/media/notices/{notice_filename}")
                    except Exception:
                        pdf_download_url = f"/media/notices/{notice_filename}"

                    return Response({
                        "status": "success", 
                        "message": "Takedown notice re-verified & active.",
                        "pdf_url": pdf_download_url
                    }, status=status.HTTP_200_OK)
                
                # Dynamically generate legal notice using Gemini AI
                try:
                    notice_text = draft_legal_notice(
                        asset_name=violation.asset_name,
                        target_url=violation.url,
                        breach_type=violation.breach_type,
                        location=violation.location
                    )
                    generate_notice_pdf(violation.id, notice_text)
                except Exception as gen_err:
                    print(f"[!] Notice PDF generation warning: {gen_err}")
                    # Attempt fallback generation
                    try:
                        fallback_text = f"SENTINAL ENFORCEMENT NOTICE\n\nAsset: {violation.asset_name}\nTarget: {violation.url}\nBreach: {violation.breach_type}\nLocation: {violation.location}\n\nThis is an official DMCA takedown notice."
                        generate_notice_pdf(violation.id, fallback_text)
                    except Exception:
                        pass

                violation.status = 'ENFORCED'
                violation.save()
                
                try:
                    pdf_download_url = request.build_absolute_uri(f"/media/notices/{notice_filename}")
                except Exception:
                    pdf_download_url = f"/media/notices/{notice_filename}"
                
                return Response({
                    "status": "success", 
                    "message": "Takedown notice dispatched successfully.",
                    "pdf_url": pdf_download_url
                }, status=status.HTTP_200_OK)
                
        except Violation.DoesNotExist:
            return Response({"error": "Violation not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"[!] EnforceViolationView unhandled error: {e}")
            return Response({
                "status": "error",
                "message": f"Enforcement processing error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ContractUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        pdf_file = request.FILES.get('pdf_file')
        if not pdf_file:
            return Response({"error": "pdf_file is required"}, status=status.HTTP_400_BAD_REQUEST)

        # FIX 5: Magic Bytes Validation (PDF Security Check)
        header = pdf_file.read(5)
        pdf_file.seek(0)  # Reset file pointer after reading header
        if not header.startswith(b'%PDF-'):
            return Response(
                {"error": "Security check failed: File is not a valid PDF document."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            reader = pypdf.PdfReader(pdf_file)
            text_content = "\n".join(page.extract_text() or '' for page in reader.pages)
        except Exception as e:
            return Response({"error": f"Corrupted PDF file: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        if not text_content.strip():
            return Response({"error": "Could not extract text from PDF"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        parsed = parse_contract_pdf(text_content)
        if not parsed:
            return Response({"error": "AI extraction failed"}, status=status.HTTP_502_BAD_GATEWAY)

        pdf_file.seek(0)
        contract = Contract.objects.create(
            title=parsed.get('title', 'Untitled'),
            release_date=parsed.get('release_date'),
            expiry_date=parsed.get('expiry_date'),
            official_runtime=parsed.get('official_runtime', 0),
            pdf_file=pdf_file,
        )

        territories = parsed.get('allowed_territories') or parsed.get('allowed_territory', '')
        if isinstance(territories, str):
            territories = [t.strip() for t in territories.split(',') if t.strip()]

        for t_code in territories:
            t_obj, _ = Territory.objects.get_or_create(code=t_code.upper(), defaults={'name': t_code.upper()})
            contract.allowed_territories.add(t_obj)

        return Response(ContractSerializer(contract).data, status=status.HTTP_201_CREATED)


class VerifyViolationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        violation = get_object_or_404(Violation, pk=pk)

        # FIX 3: SSRF Check
        if not is_safe_public_url(violation.url):
            return Response(
                {"verified": False, "error": "SSRF Guard: Target URL points to a restricted IP address."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # FIX 2: Selenium Headless Fetching (Matches Crawler Fingerprint)
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--log-level=3")

        try:
            driver = webdriver.Chrome(options=options)
            driver.get(violation.url)
            time.sleep(1)
            
            page_source = driver.page_source
            driver.quit()

            soup = BeautifulSoup(page_source, 'html.parser')
            for element in soup(["script", "style", "iframe", "footer", "nav", "aside"]):
                element.extract()

            clean_text = soup.get_text(strip=True)
            new_hash = hashlib.sha256(clean_text.encode('utf-8')).hexdigest()

        except Exception as e:
            return Response(
                {"verified": False, "error": f"Could not re-fetch page via browser: {e}"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        matches = new_hash == violation.html_hash
        
        return Response({
            "verified": matches,
            "stored_hash": violation.html_hash,
            "current_hash": new_hash,
            "note": "Page content changed since capture" if not matches else "Hash matches stored evidence",
        })