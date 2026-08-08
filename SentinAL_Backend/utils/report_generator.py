"""
SentinAL — Elite Bounty: Case Audit Report PDF Generator

Generates a professional, enterprise-grade "Case Audit Report" PDF
using ReportLab Platypus. Returns an io.BytesIO buffer for streaming
via Django FileResponse. The caller MUST close the buffer after use.
"""
import io
import html
from datetime import datetime

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable,
        Table, TableStyle
    )
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


def generate_case_audit_report(violation):
    """
    Generate a Case Audit Report PDF for a single Violation instance.

    Returns:
        io.BytesIO: PDF content buffer. Caller MUST close this buffer.

    Raises:
        RuntimeError: If ReportLab is not installed.
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError("ReportLab is not installed. Cannot generate PDF reports.")

    buffer = io.BytesIO()

    try:
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
            title=f"SentinAL Case Audit Report — Case #{violation.id}",
            author="SentinAL Enforcement Engine"
        )

        styles = getSampleStyleSheet()

        # ── Custom Typography Styles with Explicit Leading ──
        header_style = ParagraphStyle(
            'ReportHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=17,
            leading=22,
            textColor=colors.HexColor('#E50914'),
            spaceAfter=3,
        )

        subtitle_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#555555'),
            spaceAfter=14,
        )

        section_title_style = ParagraphStyle(
            'SectionTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=colors.HexColor('#111111'),
            spaceBefore=14,
            spaceAfter=6,
        )

        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#222222'),
            spaceAfter=4,
        )

        footer_style = ParagraphStyle(
            'ReportFooter',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=8,
            leading=11,
            textColor=colors.HexColor('#888888'),
            alignment=1,  # Center
        )

        elements = []

        # ═══════════════════════════════════════════
        # 1. HEADER BANNER
        # ═══════════════════════════════════════════
        header_data = [[
            Paragraph("<b>SENTINAL ENFORCEMENT ENGINE</b>", ParagraphStyle(
                'H1Banner', fontName='Helvetica-Bold', fontSize=12, leading=15,
                textColor=colors.HexColor('#E50914')
            )),
            Paragraph("<b>CASE AUDIT REPORT</b>", ParagraphStyle(
                'H2Banner', fontName='Helvetica-Bold', fontSize=10, leading=13,
                alignment=2, textColor=colors.HexColor('#333333')
            )),
        ]]
        header_table = Table(header_data, colWidths=[310, 230])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 4))
        elements.append(HRFlowable(
            width="100%", thickness=2,
            color=colors.HexColor('#E50914'), spaceAfter=14
        ))

        # ═══════════════════════════════════════════
        # 2. REPORT TITLE & SUBTITLE
        # ═══════════════════════════════════════════
        elements.append(Paragraph(
            f"Case #{violation.id} &mdash; {_safe_text(violation.asset_name)}",
            header_style
        ))
        
        gen_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
        elements.append(Paragraph(
            f"Generated: {gen_time} &bull; Classification: {_risk_label(violation.breach_type)}",
            subtitle_style
        ))

        # ═══════════════════════════════════════════
        # 3. CASE METADATA TABLE
        # ═══════════════════════════════════════════
        elements.append(Paragraph("CASE METADATA", section_title_style))

        th_style = ParagraphStyle(
            'TH', fontName='Helvetica-Bold', fontSize=9, leading=12,
            textColor=colors.white
        )
        label_style = ParagraphStyle(
            'TableLabel', fontName='Helvetica-Bold', fontSize=8.5, leading=12,
            textColor=colors.HexColor('#222222')
        )
        value_style = ParagraphStyle(
            'TableValue', fontName='Helvetica', fontSize=8.5, leading=12,
            textColor=colors.HexColor('#111111')
        )
        hash_style = ParagraphStyle(
            'TableHash', fontName='Courier', fontSize=7.5, leading=10,
            textColor=colors.HexColor('#333333')
        )

        timestamp_str = (
            violation.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
            if violation.timestamp else 'N/A'
        )

        # Status badge formatting
        status_val = str(violation.status or 'OPEN').upper()
        if status_val == 'RESOLVED':
            status_formatted = "<font color='#059669'><b>RESOLVED (TAKEDOWN COMPLETE)</b></font>"
        elif status_val == 'ENFORCED':
            status_formatted = "<font color='#D97706'><b>ENFORCED (NOTICE DISPATCHED)</b></font>"
        else:
            status_formatted = "<font color='#DC2626'><b>ACTIVE THREAT (OPEN)</b></font>"

        # Risk label formatting
        breach_val = str(violation.breach_type or '').upper()
        if breach_val == 'PRE_RELEASE':
            risk_formatted = "<font color='#7C3AED'><b>HIGH RISK &mdash; Pre-Release Leak</b></font>"
        elif breach_val == 'PIRACY':
            risk_formatted = "<font color='#DC2626'><b>MEDIUM RISK &mdash; Piracy (Unauthorized Site)</b></font>"
        elif breach_val == 'TERRITORY':
            risk_formatted = "<font color='#D97706'><b>LOW RISK &mdash; Territory Breach</b></font>"
        else:
            risk_formatted = _safe_text(violation.breach_type or 'Unclassified')

        # Investigation label formatting
        inv_label = str(violation.investigation_label or 'Not Assigned').upper()
        if inv_label == 'VERIFIED':
            inv_formatted = "<font color='#059669'><b>VERIFIED</b></font>"
        elif inv_label == 'SUSPECTED':
            inv_formatted = "<font color='#D97706'><b>SUSPECTED</b></font>"
        elif inv_label == 'NEEDS_REVIEW':
            inv_formatted = "<font color='#0284C7'><b>NEEDS REVIEW</b></font>"
        else:
            inv_formatted = _safe_text(violation.investigation_label or 'Not Assigned')

        metadata_rows = [
            [Paragraph("Field", th_style), Paragraph("Value", th_style)],
            [Paragraph("Case ID", label_style), Paragraph(f"SEN-VIOL-{violation.id}", value_style)],
            [Paragraph("Asset Name", label_style), Paragraph(_safe_text(violation.asset_name), value_style)],
            [Paragraph("Target URL", label_style), Paragraph(_safe_text(violation.url), value_style)],
            [Paragraph("Server Location", label_style), Paragraph(_safe_text(violation.location), value_style)],
            [Paragraph("Evidence Hash (SHA-256)", label_style), Paragraph(_safe_text(violation.html_hash or 'N/A'), hash_style)],
            [Paragraph("Breach Type", label_style), Paragraph(risk_formatted, value_style)],
            [Paragraph("Status", label_style), Paragraph(status_formatted, value_style)],
            [Paragraph("Logged At", label_style), Paragraph(timestamp_str, value_style)],
            [Paragraph("Investigation Label", label_style), Paragraph(inv_formatted, value_style)],
            [Paragraph("Investigator Notes", label_style), Paragraph(_safe_text(violation.investigator_notes or 'No notes recorded.'), value_style)],
        ]

        meta_table = Table(metadata_rows, colWidths=[150, 390])
        meta_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E1E1E')),
            ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [
                colors.HexColor('#F8F9FA'), colors.white
            ]),
            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ]))
        elements.append(meta_table)

        # ═══════════════════════════════════════════
        # 4. RISK ASSESSMENT & IMPACT
        # ═══════════════════════════════════════════
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("RISK ASSESSMENT & THREAT INTELLIGENCE", section_title_style))
        elements.append(HRFlowable(
            width="100%", thickness=0.5,
            color=colors.HexColor('#D1D5DB'), spaceAfter=8
        ))

        risk_map = {
            'PRE_RELEASE': ('HIGH SEVERITY', 'Pre-release content leak detected before authorized commercial release. Immediate geoblocking and DMCA notice enforcement required to prevent global dissemination.'),
            'PIRACY': ('MEDIUM SEVERITY', 'Unauthorized public streaming/download detected on pirate distribution domain. Host takedown and evidence hash verification active.'),
            'TERRITORY': ('LOW SEVERITY', 'Content served outside licensed geographic distribution territory. Geofencing restriction recommended.'),
        }
        risk_level, risk_desc = risk_map.get(
            violation.breach_type,
            ('STANDARD', 'Breach type undergoing automated verification.')
        )

        elements.append(Paragraph(
            f"<b>Assessment Level:</b> {risk_level} &bull; <b>Breach Classification:</b> {_safe_text(violation.breach_type or 'UNCLASSIFIED')}",
            body_style
        ))
        elements.append(Paragraph(risk_desc, body_style))

        # ═══════════════════════════════════════════
        # 5. FOOTER
        # ═══════════════════════════════════════════
        elements.append(Spacer(1, 24))
        elements.append(HRFlowable(
            width="100%", thickness=1,
            color=colors.HexColor('#E50914'), spaceAfter=8
        ))
        elements.append(Paragraph(
            "This report was auto-generated by the SentinAL Enforcement Engine. "
            "Contents are cryptographically hashed, legally privileged, and intended for authorized compliance officers only.",
            footer_style
        ))
        elements.append(Paragraph(
            f"&copy; {datetime.utcnow().year} SentinAL Rights Management &mdash; Team T191 (MinDBogglers)",
            footer_style
        ))

        # Build PDF into buffer
        doc.build(elements)
        buffer.seek(0)
        return buffer

    except Exception:
        buffer.close()
        raise


def _safe_text(value):
    """Escape text for safe inclusion in ReportLab Paragraph markup."""
    if not value:
        return 'N/A'
    return html.escape(str(value))


def _risk_label(breach_type):
    """Map breach_type to a human-readable risk label string."""
    mapping = {
        'PRE_RELEASE': 'HIGH RISK — Pre-Release Leak',
        'PIRACY': 'MEDIUM RISK — Piracy (Unauthorized Site)',
        'TERRITORY': 'LOW RISK — Territory Breach',
    }
    return mapping.get(breach_type, 'UNCLASSIFIED')
