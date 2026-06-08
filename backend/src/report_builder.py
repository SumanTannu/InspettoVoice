from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_summary(inspection):
    actions = []
    sections = inspection.get("sections", {})
    for section_key, section in sections.items():
        for finding in section.get("findings", []):
            if finding.get("severity") in {"warning", "critical"}:
                actions.append(
                    {
                        "section": section.get("title", section_key.title()),
                        "question": finding.get("questionLabel", "Inspection item"),
                        "action": "Review and service " + finding.get("questionLabel", "item").lower(),
                        "severity": finding.get("severity", "warning"),
                    }
                )
    if not actions:
        actions.append({"section": "General", "question": "Inspection", "action": "No immediate action required", "severity": "normal"})
    return actions


def build_pdf(inspection, template):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"CAT Inspection Report {inspection.get('inspectionId')}", styles["Title"]),
        Paragraph(f"Status: {inspection.get('status', 'in_progress').replace('_', ' ').title()}", styles["Normal"]),
        Spacer(1, 12),
    ]

    header = inspection.get("header", {})
    header_rows = [["Field", "Value"]]
    for field in template["header"]:
        header_rows.append([field["label"], header.get(field["key"], "")])
    story.append(Table(header_rows, colWidths=[190, 310]))
    story[-1].setStyle(_table_style())
    story.append(Spacer(1, 14))

    for section in template["sections"]:
        section_data = inspection.get("sections", {}).get(section["key"], {})
        story.append(Paragraph(section["title"], styles["Heading2"]))
        rows = [["Question", "Finding", "Severity", "Images"]]
        findings = {item.get("questionKey"): item for item in section_data.get("findings", [])}
        for question in section["questions"]:
            finding = findings.get(question["key"], {})
            images = _image_cell(finding)
            rows.append([question["label"], finding.get("transcript", ""), finding.get("severity", ""), images])
        table = Table(rows, colWidths=[160, 210, 70, 90])
        table.setStyle(_table_style())
        story.append(table)
        story.append(Spacer(1, 12))

    story.append(Paragraph("Needed Actions", styles["Heading2"]))
    action_rows = [["Section", "Item", "Action", "Severity"]]
    for action in inspection.get("summaryActions", build_summary(inspection)):
        action_rows.append([action["section"], action["question"], action["action"], action["severity"]])
    action_table = Table(action_rows, colWidths=[100, 150, 210, 70])
    action_table.setStyle(_table_style())
    story.append(action_table)

    doc.build(story)
    buffer.seek(0)
    return buffer


def _table_style():
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172026")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d5dde2")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f8f8")]),
        ]
    )


def _image_cell(finding):
    captures = finding.get("captures", [])
    if not captures:
        return ""

    flowables = []
    capture_dir = Path(__file__).resolve().parents[1] / "captures"
    for capture in captures[:2]:
        filename = capture.get("imageUrl", "").replace("/captures/", "")
        path = capture_dir / filename
        if path.exists():
            flowables.append(Image(str(path), width=82, height=52))
        else:
            flowables.append(Paragraph(capture.get("imageUrl", ""), getSampleStyleSheet()["BodyText"]))
    return flowables
