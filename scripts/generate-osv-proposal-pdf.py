from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "osv-proposal-draft-2026-03.pdf"


def register_arial() -> tuple[str, str]:
    regular_candidates = [
        Path("/Library/Fonts/Arial.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
    ]
    bold_candidates = [
        Path("/Library/Fonts/Arial Bold.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ]

    regular = next((path for path in regular_candidates if path.exists()), None)
    bold = next((path for path in bold_candidates if path.exists()), None)

    if regular:
        pdfmetrics.registerFont(TTFont("Arial", str(regular)))
        if bold:
            pdfmetrics.registerFont(TTFont("Arial-Bold", str(bold)))
            return "Arial", "Arial-Bold"
        return "Arial", "Helvetica-Bold"

    return "Helvetica", "Helvetica-Bold"


def build_pdf(path: Path) -> None:
    font_name, bold_font_name = register_arial()
    styles = getSampleStyleSheet()

    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName=font_name,
        fontSize=11,
        leading=16.5,
        spaceAfter=4,
        textColor=colors.HexColor("#1f2937"),
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=body,
        fontName=bold_font_name,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=10,
        leading=15,
    )
    title = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName=bold_font_name,
        fontSize=16,
        leading=18,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )

    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.45 * inch,
    )

    story = [
        Paragraph("Green Goods OSV Proposal Draft", title),
        Paragraph(
            "Applicant group: Greenpill Dev Guild | Lead: Afolabi Aiyeloja | "
            "Scope: build a low-bandwidth reporting system for ecological and civic work, "
            "then start a live pilot in month 3.",
            body,
        ),
        Spacer(1, 6),
    ]

    timeline_data = [
        [
            Paragraph("<b>Period</b>", body_bold),
            Paragraph("<b>Focus</b>", body_bold),
            Paragraph("<b>Output</b>", body_bold),
        ],
        [
            Paragraph("Months 1-2", body),
            Paragraph("Pilot-ready build", body),
            Paragraph(
                "WhatsApp, SMS, and voice intake; multilingual prompts; operator review; proof and report outputs",
                body,
            ),
        ],
        [
            Paragraph("Month 3", body),
            Paragraph("First live pilot", body),
            Paragraph("Launch Nigeria solar maintenance pilot; Cape Town remains fallback or second site", body),
        ],
        [
            Paragraph("Months 4-6", body),
            Paragraph("Field iteration", body),
            Paragraph("Improve submission quality, review speed, translation quality, and operator trust", body),
        ],
        [
            Paragraph("Months 7-9", body),
            Paragraph("Documentation and expansion", body),
            Paragraph("Case studies, proof artifacts, and optional second pilot if the first loop is stable", body),
        ],
    ]

    timeline = Table(timeline_data, colWidths=[1.15 * inch, 1.55 * inch, 3.95 * inch])
    timeline.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#94a3b8")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([timeline, Spacer(1, 6)])

    story.append(
        Paragraph(
            "<b>Primary deliverable:</b> an agentic, low-bandwidth reporting system for communities that cannot rely on full smartphone or crypto-native workflows. "
            "<b>Secondary deliverables:</b> operator review tools, plain-language proof outputs, and a pilot evidence package for funders and researchers.",
            small,
        )
    )
    story.append(
        Paragraph(
            "<b>Out of scope as headline items:</b> GreenWill badging, advanced identity, passkey-server hardening, and broader token or governance mechanics.",
            small,
        )
    )
    story.append(Spacer(1, 6))

    budget_data = [
        [
            Paragraph("<b>Budget line</b>", body_bold),
            Paragraph("<b>Fellowship</b>", body_bold),
            Paragraph("<b>Grant-safe</b>", body_bold),
        ],
        [Paragraph("Lead stipend", body), Paragraph("$54,000", body), Paragraph("-", body)],
        [Paragraph("Guild support", body), Paragraph("$18,000", body), Paragraph("$2,000", body)],
        [Paragraph("Pilot partner support", body), Paragraph("$12,000", body), Paragraph("$4,000", body)],
        [Paragraph("Messaging / AI / infra", body), Paragraph("$6,000", body), Paragraph("$2,000", body)],
        [Paragraph("Translation / docs / media", body), Paragraph("$5,000", body), Paragraph("$2,000", body)],
        [Paragraph("Travel / contingency", body), Paragraph("$5,000", body), Paragraph("-", body)],
        [
            Paragraph("<b>Total</b>", body_bold),
            Paragraph("<b>$100,000</b>", body_bold),
            Paragraph("<b>$10,000</b>", body_bold),
        ],
    ]

    budget = Table(budget_data, colWidths=[3.7 * inch, 1.35 * inch, 1.35 * inch])
    budget.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dcfce7")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#86efac")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbf7d0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([budget, Spacer(1, 6)])

    story.append(
        Paragraph(
            "<b>Month 3 release gate:</b> field workers can submit by text or voice in under five minutes; "
            "operators can resolve most submissions without engineering help; proof outputs are legible to a non-crypto reviewer; "
            "the system performs reliably in low-connectivity conditions.",
            small,
        )
    )

    doc.build(story)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    build_pdf(OUTPUT_PATH)


if __name__ == "__main__":
    main()
