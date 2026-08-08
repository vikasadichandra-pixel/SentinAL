import os
import re
import hashlib
import time
import threading

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    SELENIUM_AVAILABLE = True
except ImportError:
    webdriver = None
    Options = None
    SELENIUM_AVAILABLE = False

try:
    import pypdf
except ImportError:
    pypdf = None

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
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
from .utils import evaluate_url_for_breach, is_safe_public_url, auto_resolve_violation
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
            
            try:
                dur_val = payload_for_serializer.get('video_duration_minutes', 0)
                scraped_duration = int(float(dur_val)) if dur_val is not None else 0
            except (ValueError, TypeError):
                scraped_duration = 0

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
    serializer_class = ViolationSerializer

    def get_queryset(self):
        queryset = Violation.objects.all().order_by('-timestamp')

        # Real-time search query (?search=...)
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(asset_name__icontains=search) |
                Q(url__icontains=search) |
                Q(location__icontains=search) |
                Q(html_hash__icontains=search) |
                Q(investigator_notes__icontains=search)
            )

        # Status filter (?status=OPEN, ENFORCED, RESOLVED, ALL)
        status_param = self.request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            queryset = queryset.filter(status=status_param.upper())

        # Breach / Risk level filter (?breach_type=PRE_RELEASE, PIRACY, TERRITORY, ALL)
        breach_type_param = self.request.query_params.get('breach_type')
        if breach_type_param and breach_type_param.upper() != 'ALL':
            queryset = queryset.filter(breach_type=breach_type_param.upper())

        # Investigation label filter (?label= or ?investigation_label=)
        label_param = self.request.query_params.get('label') or self.request.query_params.get('investigation_label')
        if label_param and label_param.upper() != 'ALL':
            queryset = queryset.filter(investigation_label=label_param.upper())

        # Ordering support (?ordering=-timestamp, etc.)
        ordering_param = self.request.query_params.get('ordering')
        if ordering_param:
            allowed_orderings = [
                'timestamp', '-timestamp',
                'asset_name', '-asset_name',
                'status', '-status',
                'breach_type', '-breach_type',
                'location', '-location',
                'investigation_label', '-investigation_label'
            ]
            if ordering_param in allowed_orderings:
                queryset = queryset.order_by(ordering_param)

        return queryset


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

        # Magic Bytes Validation (PDF Security Check)
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

        # SSRF Check
        if not is_safe_public_url(violation.url):
            return Response(
                {"verified": False, "error": "SSRF Guard: Target URL points to a restricted IP address."},
                status=status.HTTP_400_BAD_REQUEST
            )

        page_source = None
        driver = None

        # Attempt 1: Fast Headless Browser Fetching with Strict Resource Cleanup
        try:
            options = Options()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--blink-settings=imagesEnabled=false")
            options.add_argument("--log-level=3")

            driver = webdriver.Chrome(options=options)
            driver.set_page_load_timeout(8)
            driver.set_script_timeout(8)
            driver.get(violation.url)
            time.sleep(0.5)
            page_source = driver.page_source
        except Exception as chrome_err:
            print(f"[!] Selenium fetch warning for {violation.url}: {chrome_err}")
        finally:
            if driver is not None:
                try:
                    driver.quit()
                except Exception:
                    pass

        # Attempt 2: High-Speed HTTP Fallback if Selenium is unavailable
        if not page_source:
            try:
                import requests
                resp = requests.get(violation.url, timeout=5, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if resp.ok:
                    page_source = resp.text
            except Exception as req_err:
                print(f"[!] HTTP fallback fetch warning: {req_err}")

        if not page_source:
            return Response(
                {"verified": False, "error": "Could not re-fetch page via browser or direct HTTP."},
                status=status.HTTP_502_BAD_GATEWAY
            )

        try:
            if BeautifulSoup:
                soup = BeautifulSoup(page_source, 'html.parser')
                for element in soup(["script", "style", "iframe", "footer", "nav", "aside"]):
                    element.extract()
                clean_text = soup.get_text(strip=True)
            else:
                clean_text = re.sub(r'<(script|style|iframe|footer|nav|aside)[^>]*>.*?</\1>', '', page_source, flags=re.DOTALL | re.IGNORECASE)
                clean_text = re.sub(r'<[^>]+>', ' ', clean_text)
                clean_text = ' '.join(clean_text.split())

            new_hash = hashlib.sha256(clean_text.encode('utf-8')).hexdigest()
        except Exception as parse_err:
            return Response(
                {"verified": False, "error": f"Failed to compute evidence hash: {parse_err}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        matches = (new_hash == violation.html_hash)
        
        return Response({
            "verified": matches,
            "stored_hash": violation.html_hash,
            "current_hash": new_hash,
            "note": "Page content changed since capture" if not matches else "Hash matches stored evidence",
        })


# ═══════════════════════════════════════════════════════════════════
# BOUNTY VIEWS — Non-destructive additions below
# ═══════════════════════════════════════════════════════════════════

class UpdateInvestigationLabelView(APIView):
    """
    Core Bounty: PATCH /api/violations/<id>/investigate/
    Allows reviewers to set an investigation label and notes on a Violation.
    Uses select_for_update() for safe concurrent writes.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        from .serializers import InvestigationLabelSerializer

        serializer = InvestigationLabelSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                violation = Violation.objects.select_for_update().get(pk=pk)
                violation.investigation_label = serializer.validated_data['investigation_label']
                violation.investigator_notes = serializer.validated_data.get('investigator_notes', '')
                violation.save(update_fields=['investigation_label', 'investigator_notes'])

            return Response({
                "status": "success",
                "id": violation.id,
                "investigation_label": violation.investigation_label,
                "investigator_notes": violation.investigator_notes,
            }, status=status.HTTP_200_OK)

        except Violation.DoesNotExist:
            return Response(
                {"error": "Violation not found."},
                status=status.HTTP_404_NOT_FOUND
            )


class ExportCaseReportView(APIView):
    """
    Elite Bounty: GET /api/violations/<id>/export-report/
    Generates a professional PDF Case Audit Report via ReportLab.
    Rate-limited via ScopedRateThrottle to prevent DoS.
    BytesIO buffer is explicitly closed in a finally block.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'export_report'

    def get(self, request, pk):
        from django.http import FileResponse
        from utils.report_generator import generate_case_audit_report

        try:
            # Use .only() to fetch only the fields needed for the report
            violation = Violation.objects.only(
                'id', 'asset_name', 'url', 'location', 'html_hash',
                'breach_type', 'status', 'timestamp',
                'investigation_label', 'investigator_notes'
            ).get(pk=pk)
        except Violation.DoesNotExist:
            return Response(
                {"error": "Violation not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        buffer = None
        try:
            buffer = generate_case_audit_report(violation)

            response = FileResponse(
                buffer,
                content_type='application/pdf',
                as_attachment=True,
                filename=f"SentinAL_Case_Report_{violation.id}.pdf"
            )
            # FileResponse takes ownership of the buffer and closes it
            # after streaming is complete, so we set buffer=None to
            # prevent the finally block from double-closing.
            buffer = None
            return response

        except RuntimeError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            return Response(
                {"error": f"PDF generation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        finally:
            # Explicit cleanup: close buffer if FileResponse didn't take ownership
            if buffer is not None:
                buffer.close()


class AutoResolveViolationView(APIView):
    """
    Automated Health Check Endpoint for a single violation:
    Pings the enforced target URL to detect if the pirate site is taken down or modified.
    If down/unreachable/modified, marks violation status as RESOLVED.
    """
    permission_classes = [AllowAny]

    def post(self, request, pk):
        violation = get_object_or_404(Violation, pk=pk)
        result = auto_resolve_violation(violation)
        return Response(result, status=status.HTTP_200_OK)

    def get(self, request, pk):
        violation = get_object_or_404(Violation, pk=pk)
        result = auto_resolve_violation(violation)
        return Response(result, status=status.HTTP_200_OK)


class BatchAutoResolveView(APIView):
    """
    Batch health check endpoint: Checks all currently ENFORCED violations
    to see if any have been taken down.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        enforced_violations = Violation.objects.filter(status='ENFORCED')
        results = []
        resolved_count = 0

        for v in enforced_violations:
            res = auto_resolve_violation(v)
            results.append(res)
            if res.get("resolved"):
                resolved_count += 1

        return Response({
            "total_checked": len(results),
            "resolved_count": resolved_count,
            "results": results
        }, status=status.HTTP_200_OK)

    def get(self, request):
        return self.post(request)