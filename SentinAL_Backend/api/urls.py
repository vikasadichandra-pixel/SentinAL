from django.urls import path
from .views import (
    EnforceViolationView, ReportViolationView, DashboardFeedView,
    ContractUploadView, VerifyViolationView,
    UpdateInvestigationLabelView, ExportCaseReportView,
    AutoResolveViolationView, BatchAutoResolveView,
)

urlpatterns = [
    # Endpoint for the Web Crawler
    path('report/', ReportViolationView.as_view(), name='report_violation'),
    
    # Endpoint for the React Frontend
    path('violations/', DashboardFeedView.as_view(), name='dashboard_feed'),

    # Endpoint to Enforce a Violation
    path('enforce/<int:pk>/', EnforceViolationView.as_view(), name='enforce_violation'),

    path('contracts/upload/', ContractUploadView.as_view(), name='contract_upload'),
    path('verify/<int:pk>/', VerifyViolationView.as_view(), name='verify_violation'),

    # ── Bounty Endpoints ──
    path('violations/<int:pk>/investigate/', UpdateInvestigationLabelView.as_view(), name='investigate_violation'),
    path('violations/<int:pk>/export-report/', ExportCaseReportView.as_view(), name='export_case_report'),

    # ── Automated Threat Resolution Engine ──
    path('violations/<int:pk>/auto-resolve/', AutoResolveViolationView.as_view(), name='auto_resolve_violation'),
    path('violations/check-all-resolved/', BatchAutoResolveView.as_view(), name='batch_auto_resolve'),
]