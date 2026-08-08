from rest_framework import serializers
from .models import Violation, Contract

class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = '__all__'

class ViolationSerializer(serializers.ModelSerializer):
    investigator_note = serializers.CharField(source='investigator_notes', read_only=True, allow_null=True)
    dmca_pdf_url = serializers.SerializerMethodField()
    audit_report_url = serializers.SerializerMethodField()

    class Meta:
        model = Violation
        fields = [
            'id', 'asset_name', 'url', 'location', 'timestamp',
            'status', 'breach_type', 'html_hash',
            'investigation_label', 'investigator_notes', 'investigator_note',
            'dmca_pdf_url', 'audit_report_url'
        ]

    def get_dmca_pdf_url(self, obj):
        if obj.status == 'ENFORCED':
            notice_filename = f"Notice_Violation_{obj.id}.pdf"
            request = self.context.get('request')
            path = f"/media/notices/{notice_filename}"
            if request:
                return request.build_absolute_uri(path)
            return path
        return None

    def get_audit_report_url(self, obj):
        request = self.context.get('request')
        path = f"/api/violations/{obj.id}/export-report/"
        if request:
            return request.build_absolute_uri(path)
        return path

class CrawlerReportSerializer(serializers.ModelSerializer):
    video_duration_seconds = serializers.FloatField(write_only=True, required=False)
    video_duration_minutes = serializers.FloatField(write_only=True, required=False)

    class Meta:
        model = Violation
        fields = '__all__'

    def create(self, validated_data):
        # Pop duration fields that are used for verification rather than stored directly on Violation
        validated_data.pop('video_duration_seconds', None)
        validated_data.pop('video_duration_minutes', None)
        return super().create(validated_data)


class InvestigationLabelSerializer(serializers.Serializer):
    """
    Serializer for the Core Bounty — Investigation Labels.
    Sanitizes investigator_notes via strip_tags to prevent stored XSS.
    """
    LABEL_CHOICES = [
        ('SUSPECTED', 'Suspected'),
        ('VERIFIED', 'Verified'),
        ('NEEDS_REVIEW', 'Needs Review'),
    ]
    investigation_label = serializers.ChoiceField(
        choices=LABEL_CHOICES,
        required=True,
        help_text="One of: SUSPECTED, VERIFIED, NEEDS_REVIEW"
    )
    investigator_notes = serializers.CharField(
        max_length=1000,
        required=False,
        allow_blank=True,
        default='',
        help_text="Short investigator note (HTML stripped for XSS protection)"
    )

    def validate_investigator_notes(self, value):
        """Strip all HTML tags to prevent XSS injection in investigator notes."""
        from django.utils.html import strip_tags
        if value:
            return strip_tags(value).strip()
        return value