import re
from dataclasses import dataclass
from typing import Iterable


@dataclass
class InspectionCommand:
    transcript: str
    should_capture: bool
    severity: str
    notes: list[str]
    tags: list[str]
    issue_words: list[str]
    values: list[str]
    next_prompt: bool


SEVERITY_TERMS = {
    "critical": {"critical", "danger", "unsafe", "shutdown", "broken", "leak", "rust", "bad"},
    "warning": {"warning", "worn", "high", "low", "dent", "damage", "black", "brown", "replace", "replacement"},
    "normal": {"normal", "ok", "okay", "pass", "stable", "clean"},
}

ISSUE_WORDS = {
    "broken",
    "high",
    "low",
    "rust",
    "worn",
    "leak",
    "damage",
    "dent",
    "bad",
    "black",
    "brown",
    "replacement",
    "replace",
}

NEXT_WORDS = {"ok", "okay", "record", "next", "done", "complete"}


def parse_inspection_command(transcript: str, capture_keywords: Iterable[str]) -> InspectionCommand:
    normalized = transcript.lower().strip()
    tokens = set(re.findall(r"[a-zA-Z]+", normalized))
    issue_words = sorted(tokens.intersection(ISSUE_WORDS))
    should_capture = any(keyword in normalized for keyword in capture_keywords) or bool(issue_words)

    severity = "normal"
    for level in ("critical", "warning"):
        if tokens.intersection(SEVERITY_TERMS[level]):
            severity = level
            break

    notes = []
    if issue_words:
        notes.append("Issue keywords detected: " + ", ".join(issue_words))
    if "low" in tokens:
        notes.append("Concerned parameter value may be below expected range")
    if "high" in tokens:
        notes.append("Concerned parameter value may be above expected range")
    if "leak" in tokens or "rust" in tokens or "damage" in tokens or "broken" in tokens:
        notes.append("Image evidence recommended for this finding")

    tags = sorted(
        tokens.intersection(
            {"tire", "battery", "exterior", "brake", "engine", "customer", "windshield", "suspension", "oil"}
        )
    )
    values = re.findall(r"\b\d+(?:\.\d+)?\s?(?:v|volt|volts|psi|hours|hrs|km|mi)?\b", normalized)

    return InspectionCommand(
        transcript=transcript,
        should_capture=should_capture,
        severity=severity,
        notes=notes,
        tags=tags,
        issue_words=issue_words,
        values=values,
        next_prompt=bool(tokens.intersection(NEXT_WORDS)),
    )
