from django.urls import path
from .views import (EnforceViolationView, ReportViolationView, DashboardFeedView,ContractUploadView,VerifyViolationView,)

urlpatterns = [
    # Endpoint for the Web Crawler
    path('report/', ReportViolationView.as_view(), name='report_violation'),
    
    # Endpoint for the React Frontend
    path('violations/', DashboardFeedView.as_view(), name='dashboard_feed'),

    # Endpoint to Enforce a Violation
    path('enforce/<int:pk>/', EnforceViolationView.as_view(), name='enforce_violation'),

    path('contracts/upload/', ContractUploadView.as_view(), name='contract_upload'),
    path('verify/<int:pk>/', VerifyViolationView.as_view(), name='verify_violation'),
]