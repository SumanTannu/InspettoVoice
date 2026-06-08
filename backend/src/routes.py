from pathlib import Path

from flask import Blueprint, jsonify, request, send_file, send_from_directory

from .camera import CameraService
from .config import Config
from .google_cloud import SpeechService, TextToSpeechService
from .nlp import parse_inspection_command
from .report_builder import build_pdf, build_summary
from .repository import InspectionRepository
from .template import get_template


api = Blueprint("api", __name__)
camera_service = CameraService()
speech_service = SpeechService()
tts_service = TextToSpeechService()
repository = InspectionRepository()


@api.get("/health")
def health():
    return jsonify({"status": "ok", "googleCloud": Config.USE_GOOGLE_CLOUD})


@api.get("/template")
def template():
    return jsonify(get_template())


@api.post("/inspections")
def create_inspection():
    body = request.get_json(silent=True) or {}
    template_data = get_template()
    sections = {
        section["key"]: {
            "title": section["title"],
            "findings": [],
            "complete": False,
        }
        for section in template_data["sections"]
    }
    inspection = repository.create(
        {
            "header": body.get("header", {}),
            "language": body.get("language", Config.DEFAULT_LANGUAGE),
            "sections": sections,
            "summaryActions": [],
            "validatedAt": None,
        }
    )
    return jsonify(inspection), 201


@api.post("/inspections/<inspection_id>/record")
def record_finding(inspection_id):
    language = request.form.get("language", Config.DEFAULT_LANGUAGE)
    section_key = request.form.get("sectionKey", "")
    section_title = request.form.get("sectionTitle", section_key.title())
    question_key = request.form.get("questionKey", "")
    question_label = request.form.get("questionLabel", "Inspection item")
    audio = request.files.get("audio")
    transcript = request.form.get("transcript", "")

    if audio:
        transcript = speech_service.transcribe(audio.read(), language)
    if not transcript:
        transcript = "OK"

    command = parse_inspection_command(transcript, Config.CAPTURE_KEYWORDS)
    capture = camera_service.capture_image() if command.should_capture else None
    inspection = repository.find_by_report_id(inspection_id)
    if inspection is None:
        return jsonify({"error": "Inspection not found"}), 404

    sections = inspection.get("sections", {})
    section = sections.setdefault(section_key, {"title": section_title, "findings": [], "complete": False})
    findings = [item for item in section.get("findings", []) if item.get("questionKey") != question_key]
    finding = {
        "sectionKey": section_key,
        "sectionTitle": section_title,
        "questionKey": question_key,
        "questionLabel": question_label,
        "transcript": command.transcript,
        "severity": command.severity,
        "notes": command.notes,
        "tags": command.tags,
        "issueWords": command.issue_words,
        "values": command.values,
        "nextPrompt": command.next_prompt,
        "captures": [capture] if capture else [],
    }
    findings.append(finding)
    section["findings"] = findings
    sections[section_key] = section

    updated = repository.update(
        inspection_id,
        {
            "sections": sections,
            "language": language,
            "status": "in_progress",
            "summaryActions": build_summary({"sections": sections}),
        },
    )
    return jsonify({"inspection": updated, "finding": finding})


@api.patch("/inspections/<inspection_id>")
def update_inspection(inspection_id):
    body = request.get_json(force=True)
    inspection = repository.update(inspection_id, body)
    if inspection is None:
        return jsonify({"error": "Inspection not found"}), 404
    return jsonify(inspection)


@api.post("/inspections/<inspection_id>/validate")
def validate_inspection(inspection_id):
    inspection = repository.find_by_report_id(inspection_id)
    if inspection is None:
        return jsonify({"error": "Inspection not found"}), 404
    summary_actions = build_summary(inspection)
    updated = repository.update(
        inspection_id,
        {
            "status": "completed",
            "summaryActions": summary_actions,
            "validatedAt": inspection.get("updatedAt"),
        },
    )
    return jsonify(updated)


@api.post("/voice/inspect")
def inspect_voice():
    language = request.form.get("language", Config.DEFAULT_LANGUAGE)
    audio = request.files.get("audio")
    transcript = request.form.get("transcript", "")

    if audio:
        transcript = speech_service.transcribe(audio.read(), language)
    if not transcript:
        transcript = "Inspection completed with no spoken notes."

    command = parse_inspection_command(transcript, Config.CAPTURE_KEYWORDS)
    capture = camera_service.capture_image() if command.should_capture else None
    report = repository.create(
        {
            "equipmentId": request.form.get("equipmentId", "EQ-1001"),
            "technician": request.form.get("technician", "Field Technician"),
            "language": language,
            "transcript": command.transcript,
            "severity": command.severity,
            "notes": command.notes,
            "tags": command.tags,
            "capture": capture,
        }
    )
    return jsonify(report)


@api.post("/voice/prompt")
def prompt_voice():
    body = request.get_json(force=True)
    return jsonify(tts_service.synthesize(body.get("text", ""), body.get("language", Config.DEFAULT_LANGUAGE)))


@api.post("/voice/transcribe")
def transcribe_voice():
    language = request.form.get("language", Config.DEFAULT_LANGUAGE)
    audio = request.files.get("audio")
    transcript = request.form.get("transcript", "")
    if audio:
        transcript = speech_service.transcribe(audio.read(), language)
    return jsonify({"transcript": transcript})


@api.get("/reports")
def reports():
    query = request.args.get("q", "")
    status = request.args.get("status", "")
    return jsonify(repository.search(query=query, status=status))


@api.get("/reports/<inspection_id>")
def report_detail(inspection_id):
    inspection = repository.find_by_report_id(inspection_id)
    if inspection is None:
        return jsonify({"error": "Inspection not found"}), 404
    return jsonify(inspection)


@api.get("/reports/<inspection_id>/pdf")
def report_pdf(inspection_id):
    inspection = repository.find_by_report_id(inspection_id)
    if inspection is None:
        return jsonify({"error": "Inspection not found"}), 404
    pdf = build_pdf(inspection, get_template())
    return send_file(
        pdf,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"{inspection.get('inspectionId', inspection_id)}.pdf",
    )


@api.get("/captures/<path:filename>")
def captures(filename):
    capture_dir = Path(__file__).resolve().parents[1] / "captures"
    return send_from_directory(capture_dir, filename)
