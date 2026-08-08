import os
import html
from django.conf import settings

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

def generate_notice_pdf(violation_id, legal_text):
    """
    Generates a structured, enterprise-grade PDF notice using ReportLab Platypus.
    Falls back gracefully if ReportLab is not installed.
    """
    filename = f"Notice_Violation_{violation_id}.pdf"
    save_dir = os.path.join(settings.MEDIA_ROOT, 'notices')
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, filename)

    if not REPORTLAB_AVAILABLE:
        # Minimal valid PDF file fallback with notice content
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"SENTINAL ENFORCEMENT NOTICE #{violation_id}\n\n{legal_text}")
        return file_path

    # Document setup with explicit metadata title and author
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
        title=f"SentinAL Takedown Notice - Ref #{violation_id}",
        author="SentinAL Rights Management"
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#1A1A1A'),
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#666666'),
        spaceAfter=10
    )

    body_style = ParagraphStyle(
        'NoticeBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#222222'),
        spaceAfter=8
    )

    footer_style = ParagraphStyle(
        'FooterStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        textColor=colors.HexColor('#888888'),
        alignment=1
    )

    elements = []

    # 1. Header Banner
    header_data = [
        [
            Paragraph("<b>SENTINAL ENFORCEMENT ENGINE</b>", ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#E50914'))),
            Paragraph(f"<b>REF ID:</b> SEN-VIOL-{violation_id}", ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=10, alignment=2, textColor=colors.HexColor('#444444')))
        ]
    ]
    header_table = Table(header_data, colWidths=[300, 240])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8))

    # Divider Line
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#E50914'), spaceAfter=15))

    # 2. Main Title
    elements.append(Paragraph("OFFICIAL CEASE &amp; DESIST / DMCA TAKEDOWN NOTICE", title_style))
    elements.append(Paragraph("Issued under Section 512(c) of the Digital Millennium Copyright Act (17 U.S.C. &sect; 512)", subtitle_style))
    elements.append(Spacer(1, 10))

    # 3. Body Content
    paragraphs = legal_text.split('\n\n')
    for p in paragraphs:
        # Check if this paragraph is part of the top address block/header
        is_header_block = any(keyword in p for keyword in [
            "SentinAL Rights Management", 
            "Century City Plaza", 
            "Los Angeles", 
            "Email: enforcement@", 
            "Date:"
        ])

        # Escape HTML entities safely first
        escaped_p = html.escape(p.strip())
        # Replace newlines with linebreaks
        formatted_p = escaped_p.replace('\n', '<br/>')

        if is_header_block:
            elements.append(Paragraph(formatted_p, ParagraphStyle(
                'HeaderBlock',
                parent=body_style,
                leading=12,
                spaceAfter=4
            )))
        else:
            if formatted_p:
                elements.append(Paragraph(formatted_p, body_style))

    # Build PDF
    doc.build(elements)
    return file_path