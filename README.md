# InspettoVoice

AI-driven CAT-style equipment inspection platform with multilingual voice prompts, keyword-triggered image capture, real-time report validation, searchable inspection history, and PDF export.

## Stack

- Backend: Python, Flask, OpenCV, Google Cloud Speech/Text-to-Speech hooks, MongoDB, ReportLab
- Frontend: Next.js, TypeScript, TailwindCSS
- NLP: inspection command parsing, issue keyword detection, parameter value extraction

## Project Structure

```text
backend/   Flask API, OpenCV capture, NLP parser, MongoDB repository
frontend/  Next.js inspection console
```

## Implemented MVP Capabilities

- CAT Inspect truck template with header fields and sections for Tires, Battery, Exterior, Brakes, Engine, and Voice of Customer.
- Voice-guided prompts generated from the questionnaire.
- Voice/manual finding capture per question.
- `OK`, `Record`, `Next`, and `Done` command handling for prompt progression.
- Issue keyword recognition for words such as `broken`, `high`, `low`, `rust`, `worn`, `leak`, `damage`, `dent`, `bad`, `black`, and `replacement`.
- OpenCV image capture when evidence or issue keywords are detected, with a placeholder image when no camera is available.
- Inspector validation flow that marks reports as completed.
- Searchable report list by report ID, truck serial number, or customer name.
- Generated summary actions based on warning/critical findings.
- PDF export with header data, section findings, severity, image references, and needed actions.
- Google Cloud Speech-to-Text and Text-to-Speech integration hooks with local mock/browser fallbacks.

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python app.py
```

The API starts on `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app starts on `http://localhost:3000`.

## API Highlights

- `GET /api/template` - CAT inspection questionnaire.
- `POST /api/inspections` - create an in-progress inspection.
- `POST /api/inspections/<inspectionId>/record` - record a section/question finding from voice or text.
- `PATCH /api/inspections/<inspectionId>` - update header/language/report fields.
- `POST /api/inspections/<inspectionId>/validate` - validate and complete the report.
- `GET /api/reports?q=<query>` - list/search inspections.
- `GET /api/reports/<inspectionId>/pdf` - export inspection PDF.

## Google Cloud Setup

The backend runs with deterministic mock speech responses by default. To use Google Cloud:

1. Create a Google Cloud project.
2. Enable Speech-to-Text and Text-to-Speech APIs.
3. Create a service account and download the JSON key.
4. Set `GOOGLE_APPLICATION_CREDENTIALS` to that JSON path.
5. Set `USE_GOOGLE_CLOUD=true` in `backend/.env`.

## MongoDB

If `MONGO_URI` is unavailable, the backend uses an in-memory repository for local demos. Set `MONGO_URI=mongodb://localhost:27017` for persistent storage.
