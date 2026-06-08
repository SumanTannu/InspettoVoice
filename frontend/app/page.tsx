"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, ClipboardList, Download, FileSearch, Mic, PlayCircle, RefreshCcw, Save, Search, ShieldAlert, Volume2 } from "lucide-react";

type Question = {
  key: string;
  label: string;
  type: string;
  unit?: string;
  options?: string[];
  imageOnYes?: boolean;
  maxLength?: number;
  example?: string;
};

type TemplateSection = {
  key: string;
  title: string;
  questions: Question[];
};

type Template = {
  name: string;
  header: { key: string; label: string; example: string }[];
  sections: TemplateSection[];
};

type Finding = {
  questionKey: string;
  questionLabel: string;
  transcript: string;
  severity: "normal" | "warning" | "critical";
  notes: string[];
  issueWords: string[];
  values: string[];
  captures: { imageUrl: string; source: string }[];
};

type Inspection = {
  _id: string;
  inspectionId: string;
  status: "in_progress" | "completed";
  createdAt: string;
  updatedAt: string;
  language: string;
  header: Record<string, string>;
  sections: Record<string, { title: string; findings: Finding[]; complete: boolean }>;
  summaryActions: { section: string; question: string; action: string; severity: string }[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const languages = [
  { label: "English", value: "en-US" },
  { label: "Hindi", value: "hi-IN" },
  { label: "Tamil", value: "ta-IN" },
  { label: "Spanish", value: "es-ES" }
];

const emptyHeader = {
  truckSerialNumber: "",
  truckModel: "",
  inspectorName: "",
  employeeId: "",
  location: "",
  geoCoordinates: "",
  serviceMeterHours: "",
  customerName: "",
  catCustomerId: "",
  inspectorSignature: ""
};

export default function Home() {
  const [template, setTemplate] = useState<Template | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [reports, setReports] = useState<Inspection[]>([]);
  const [header, setHeader] = useState<Record<string, string>>(emptyHeader);
  const [language, setLanguage] = useState("en-US");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [findingText, setFindingText] = useState("");
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voicePhase, setVoicePhase] = useState("idle");

  const recognitionRef = useRef<any>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const inspectionRef = useRef<Inspection | null>(null);
  const headerRef = useRef<Record<string, string>>(emptyHeader);
  const templateItemsRef = useRef<TemplateSection[]>([]);
  const runIdRef = useRef(0);

  const templateItems = useMemo<TemplateSection[]>(() => {
    if (!template) return [];
    return [
      {
        key: "header",
        title: "Header",
        questions: template.header.map((field) => ({
          key: field.key,
          label: field.label,
          type: "text",
          example: field.example
        }))
      },
      ...template.sections
    ];
  }, [template]);

  const section = templateItems[sectionIndex];
  const question = section?.questions[questionIndex];
  const isHeaderQuestion = section?.key === "header";
  const reviewMode = voicePhase === "complete" || inspection?.status === "completed";
  const currentFinding = useMemo(() => {
    if (!inspection || !section || !question || isHeaderQuestion) return undefined;
    return inspection.sections[section.key]?.findings.find((item) => item.questionKey === question.key);
  }, [inspection, section, question, isHeaderQuestion]);

  const completion = useMemo(() => {
    if (!template || !inspection) return { done: 0, total: 0 };
    const headerDone = template.header.filter((field) => Boolean(header[field.key]?.trim())).length;
    const headerTotal = template.header.length;
    const sectionTotal = template.sections.reduce((sum, item) => sum + item.questions.length, 0);
    const sectionDone = template.sections.reduce((sum, item) => sum + (inspection.sections[item.key]?.findings.length ?? 0), 0);
    return { done: headerDone + sectionDone, total: headerTotal + sectionTotal };
  }, [template, inspection, header]);

  useEffect(() => {
    loadTemplate();
    loadReports();
  }, []);

  useEffect(() => {
    inspectionRef.current = inspection;
  }, [inspection]);

  useEffect(() => {
    headerRef.current = header;
  }, [header]);

  useEffect(() => {
    templateItemsRef.current = templateItems;
  }, [templateItems]);

  async function loadTemplate() {
    const response = await fetch(`${API_URL}/template`);
    setTemplate(await response.json());
  }

  async function loadReports(query = searchText) {
    const response = await fetch(`${API_URL}/reports?q=${encodeURIComponent(query)}`);
    setReports(await response.json());
  }

  async function createInspection() {
    const response = await fetch(`${API_URL}/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ header, language })
    });
    const created = await response.json();
    inspectionRef.current = created;
    setInspection(created);
    setSectionIndex(0);
    setQuestionIndex(0);
    setFindingText("");
    await loadReports();
    return created;
  }

  async function startGuidedFlow() {
    setLoading(true);
    try {
      await createInspection();
      setFlowStarted(true);
      await speakText("Hi, hello. Welcome to CAT Inspect. I will guide you through each item. I will repeat what I heard. Say yes to confirm, or no to correct it.");
      setTimeout(() => runVoiceStep(0, 0), 250);
    } finally {
      setLoading(false);
    }
  }

  async function speakText(text: string) {
    try {
      const response = await fetch(`${API_URL}/voice/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language })
      });
      const result = await response.json();
      if (result.audioContent) {
        await new Promise<void>((resolve) => {
          const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play();
        });
        return;
      }
    } catch {
      // Browser speech synthesis is the offline fallback.
    }

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  async function recordVoiceOnce() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      return new Promise<string>((resolve) => {
        const recognition = new SpeechRecognition();
        let transcript = "";
        recognition.lang = language;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
          transcript = event.results?.[0]?.[0]?.transcript ?? "";
        };
        recognition.onend = () => {
          setRecording(false);
          resolve(transcript);
        };
        recognition.onerror = () => {
          setRecording(false);
          resolve("");
        };
        recognitionRef.current = recognition;
        setRecording(true);
        recognition.start();
      });
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks.current = [];
    return new Promise<string>((resolve) => {
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (event) => chunks.current.push(event.data);
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const formData = new FormData();
        formData.append("language", language);
        formData.append("audio", new Blob(chunks.current, { type: "audio/webm" }), "voice.webm");
        const response = await fetch(`${API_URL}/voice/inspect`, { method: "POST", body: formData });
        const payload = await response.json();
        setRecording(false);
        resolve(payload.transcript ?? "");
      };
      setRecording(true);
      mediaRecorder.current.start();
      setTimeout(() => mediaRecorder.current?.stop(), 4500);
    });
  }

  async function saveAnswer(answer: string, targetSection: TemplateSection, targetQuestion: Question) {
    const activeInspection = inspectionRef.current;
    if (!activeInspection) return;

    if (targetSection.key === "header") {
      const value = cleanHeaderTranscript(answer);
      const nextHeader = { ...headerRef.current, [targetQuestion.key]: value };
      headerRef.current = nextHeader;
      setHeader(nextHeader);
      setFindingText(value);
      const response = await fetch(`${API_URL}/inspections/${activeInspection.inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header: nextHeader, language })
      });
      const updated = await response.json();
      inspectionRef.current = updated;
      setInspection(updated);
      await loadReports();
      return;
    }

    const formData = new FormData();
    formData.append("language", language);
    formData.append("sectionKey", targetSection.key);
    formData.append("sectionTitle", targetSection.title);
    formData.append("questionKey", targetQuestion.key);
    formData.append("questionLabel", targetQuestion.label);
    formData.append("transcript", answer);
    const response = await fetch(`${API_URL}/inspections/${activeInspection.inspectionId}/record`, { method: "POST", body: formData });
    const payload = await response.json();
    inspectionRef.current = payload.inspection;
    setInspection(payload.inspection);
    setFindingText(payload.finding.transcript);
    await loadReports();
  }

  async function runVoiceStep(targetSectionIndex: number, targetQuestionIndex: number) {
    const runId = ++runIdRef.current;
    const items = templateItemsRef.current;
    const targetSection = items[targetSectionIndex];
    const targetQuestion = targetSection?.questions[targetQuestionIndex];
    if (!targetSection || !targetQuestion) return;

    setSectionIndex(targetSectionIndex);
    setQuestionIndex(targetQuestionIndex);
    setPendingTranscript("");
    setFindingText(targetSection.key === "header" ? headerRef.current[targetQuestion.key] ?? "" : "");

    setVoicePhase("prompting");
    await speakText(targetSection.key === "header" ? buildHeaderPrompt(targetQuestion) : buildPrompt(targetQuestion));
    if (runId !== runIdRef.current) return;

    setVoicePhase("listening");
    const answer = cleanSpokenAnswer(await recordVoiceOnce());
    if (runId !== runIdRef.current) return;
    if (!answer) {
      setVoicePhase("retrying");
      await speakText("I did not hear a response. Let us try again.");
      await runVoiceStep(targetSectionIndex, targetQuestionIndex);
      return;
    }

    setPendingTranscript(answer);
    setFindingText(answer);
    setVoicePhase("confirming");
    await speakText(`I heard: ${answer}. Is this correct? Say yes to continue, or no to correct it.`);
    if (runId !== runIdRef.current) return;
    const confirmation = await recordVoiceOnce();
    if (runId !== runIdRef.current) return;

    if (isNegative(confirmation)) {
      setVoicePhase("retrying");
      await speakText("Okay. Let us capture it again.");
      await runVoiceStep(targetSectionIndex, targetQuestionIndex);
      return;
    }

    if (!isAffirmative(confirmation)) {
      await speakText("Please say yes to confirm, or no to correct.");
      const secondConfirmation = await recordVoiceOnce();
      if (!isAffirmative(secondConfirmation)) {
        await speakText("Okay. Let us capture it again.");
        await runVoiceStep(targetSectionIndex, targetQuestionIndex);
        return;
      }
    }

    setVoicePhase("saving");
    await saveAnswer(answer, targetSection, targetQuestion);
    const next = getNextPosition(targetSectionIndex, targetQuestionIndex, items);
    if (!next) {
      setVoicePhase("complete");
      await speakText("Inspection capture is complete. Please review and validate the report. Manual corrections are now available.");
      return;
    }

    setVoicePhase("moving");
    await speakText("Saved. Moving to the next item.");
    await runVoiceStep(next.sectionIndex, next.questionIndex);
  }

  async function saveManualCorrection() {
    if (!section || !question) return;
    setLoading(true);
    try {
      await saveAnswer(findingText, section, question);
    } finally {
      setLoading(false);
    }
  }

  async function validateInspection() {
    if (!inspection) return;
    const response = await fetch(`${API_URL}/inspections/${inspection.inspectionId}/validate`, { method: "POST" });
    const updated = await response.json();
    inspectionRef.current = updated;
    setInspection(updated);
    setVoicePhase("complete");
    await loadReports();
  }

  function selectTask(nextSectionIndex: number, nextQuestionIndex: number) {
    const targetSection = templateItems[nextSectionIndex];
    const targetQuestion = targetSection?.questions[nextQuestionIndex];
    if (!targetSection || !targetQuestion) return;
    setSectionIndex(nextSectionIndex);
    setQuestionIndex(nextQuestionIndex);
    setFindingText(targetSection.key === "header" ? header[targetQuestion.key] ?? "" : "");
    if (!reviewMode) {
      setTimeout(() => runVoiceStep(nextSectionIndex, nextQuestionIndex), 100);
    }
  }

  function selectReport(report: Inspection) {
    runIdRef.current += 1;
    setInspection(report);
    inspectionRef.current = report;
    setHeader({ ...emptyHeader, ...report.header });
    setLanguage(report.language || "en-US");
    setFlowStarted(true);
    setVoicePhase("complete");
  }

  if (!template) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-steel">Loading CAT Inspect workspace...</main>;
  }

  if (!flowStarted || !inspection || !section || !question) {
    return (
      <main className="min-h-screen bg-[#f4f7f6]">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-ink">CAT Inspect</h1>
              <p className="mt-1 text-sm text-steel">Voice-guided equipment inspection</p>
            </div>
            <Metric label="Template" value={template.name.replace(" Truck MVP", "")} />
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-signal">Ready</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">Hi, hello. Let us start the CAT inspection.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              The app will prompt, listen, read back what it heard, and continue only after you say yes.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60" onClick={startGuidedFlow} disabled={loading}>
                <PlayCircle className="h-5 w-5" />
                Start Inspection
              </button>
              <label className="block min-w-56 text-sm font-medium text-ink">
                Voice Language
                <select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  {languages.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <ReportList reports={reports} onSelect={selectReport} />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f6]">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-ink">CAT Inspect</h1>
            <p className="mt-1 text-sm text-steel">{inspection.inspectionId} - {inspection.status.replace("_", " ")}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Progress" value={`${completion.done}/${completion.total}`} />
            <Metric label="Actions" value={(inspection.summaryActions?.length ?? 0).toString()} />
            <Metric label="Language" value={languages.find((item) => item.value === language)?.label ?? "English"} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[320px_1fr_360px]">
        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Template</h2>
              <ClipboardList className="h-5 w-5 text-signal" />
            </div>
            <div className="space-y-2">
              {templateItems.map((item, index) => {
                const done = item.key === "header" ? template.header.filter((field) => Boolean(header[field.key]?.trim())).length : inspection.sections[item.key]?.findings.length ?? 0;
                const active = index === sectionIndex;
                return (
                  <div key={item.key} className={`rounded-md border px-3 py-2 ${active ? "border-ink bg-slate-100 text-ink" : "border-slate-200 bg-white text-steel"}`}>
                    <button className="flex w-full items-center justify-between text-left text-sm" onClick={() => selectTask(index, 0)}>
                      <span>{item.title}</span>
                      <span>{done}/{item.questions.length}</span>
                    </button>
                    <select className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-ink" value={active ? questionIndex : ""} onChange={(event) => selectTask(index, Number(event.target.value))}>
                      <option value="" disabled>Select task</option>
                      {item.questions.map((task, taskIndex) => (
                        <option key={task.key} value={taskIndex}>{taskIndex + 1}. {task.label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <label className="mt-4 block text-sm font-medium text-ink">
              Voice Language
              <select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2" value={language} onChange={(event) => setLanguage(event.target.value)}>
                {languages.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-signal">{section.title} - Item {questionIndex + 1} of {section.questions.length}</p>
                <h2 className="mt-1 text-2xl font-semibold text-ink">{question.label}</h2>
                <p className="mt-2 text-sm text-steel">{isHeaderQuestion ? buildHeaderPrompt(question) : buildPrompt(question)}</p>
              </div>
              <button className="rounded-md border border-slate-300 p-2 hover:bg-slate-50" onClick={() => speakText(isHeaderQuestion ? buildHeaderPrompt(question) : buildPrompt(question))} title="Replay prompt">
                <Volume2 className="h-5 w-5" />
              </button>
            </div>

            {question.options && reviewMode && (
              <div className="mt-4 flex flex-wrap gap-2">
                {question.options.map((option) => (
                  <button key={option} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setFindingText(option)}>{option}</button>
                ))}
              </div>
            )}

            <textarea className="mt-4 min-h-36 w-full rounded-md border border-slate-300 p-3 text-sm leading-6 outline-none focus:border-signal" maxLength={question.maxLength} readOnly={!reviewMode} value={findingText} onChange={(event) => setFindingText(event.target.value)} />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${recording ? "bg-red-50 text-danger" : "bg-slate-100 text-ink"}`}>
                <Mic className="h-4 w-4" />
                {voiceStatusLabel(voicePhase, recording)}
              </div>
              {pendingTranscript && <span className="rounded-md bg-slate-100 px-3 py-2 text-sm text-steel">Heard: {pendingTranscript}</span>}
              {!reviewMode && (
                <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50" onClick={() => runVoiceStep(sectionIndex, questionIndex)} disabled={loading || recording}>
                  <Volume2 className="h-4 w-4" />
                  Repeat Prompt
                </button>
              )}
              {reviewMode && (
                <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50" onClick={saveManualCorrection} disabled={loading}>
                  <Save className="h-4 w-4" />
                  Save Correction
                </button>
              )}
            </div>
          </div>

          {currentFinding && (
            <div className="grid gap-5 md:grid-cols-[1fr_260px]">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Validated Finding</h2>
                  <Severity severity={currentFinding.severity} />
                </div>
                <p className="text-sm leading-6 text-steel">{currentFinding.transcript}</p>
                {currentFinding.notes.length > 0 && (
                  <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-caution">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{currentFinding.notes.join(". ")}</span>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Images</h2>
                  <Camera className="h-5 w-5 text-signal" />
                </div>
                {currentFinding.captures.length > 0 ? (
                  <div className="space-y-2">
                    {currentFinding.captures.map((capture) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={capture.imageUrl} className="aspect-video w-full rounded-md object-cover" src={`${API_ORIGIN}/api${capture.imageUrl}`} alt="Inspection evidence" />
                    ))}
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-md bg-slate-100 text-sm text-steel">No image captured</div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report Summary</h2>
              <button className="inline-flex items-center gap-2 rounded-md bg-signal px-3 py-2 text-sm font-medium text-white hover:bg-teal-800" onClick={validateInspection}>
                <Check className="h-4 w-4" />
                Validate
              </button>
            </div>
            <div className="space-y-2">
              {(inspection.summaryActions ?? []).map((action, index) => (
                <div key={`${action.section}-${index}`} className="grid gap-2 rounded-md border border-slate-200 p-3 text-sm md:grid-cols-[110px_1fr_90px]">
                  <span className="font-semibold">{action.section}</span>
                  <span className="text-steel">{action.action}</span>
                  <Severity severity={action.severity as Finding["severity"]} />
                </div>
              ))}
              {(inspection.summaryActions ?? []).length === 0 && <p className="text-sm text-steel">Actions appear after issue findings are confirmed.</p>}
            </div>
            <a className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50" href={`${API_URL}/reports/${inspection.inspectionId}/pdf`}>
              <Download className="h-4 w-4" />
              Export PDF
            </a>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Inspections</h2>
              <FileSearch className="h-5 w-5 text-signal" />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-steel" />
                <input className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm" placeholder="Report ID, serial, customer" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
              </div>
              <button className="rounded-md border border-slate-300 p-2 hover:bg-slate-50" onClick={() => loadReports()} title="Search">
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
            <button className="mt-3 w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:bg-slate-700" onClick={startGuidedFlow}>
              New Inspection
            </button>
            <div className="mt-4 max-h-[620px] divide-y divide-slate-100 overflow-auto">
              {reports.map((report) => (
                <button key={report._id} className="block w-full py-3 text-left hover:bg-slate-50" onClick={() => selectReport(report)}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-ink">{report.inspectionId}</span>
                    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${report.status === "completed" ? "bg-emerald-50 text-signal" : "bg-slate-100 text-steel"}`}>{report.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-steel">{report.header?.truckSerialNumber || "No serial"} - {report.header?.customerName || "No customer"}</p>
                  <p className="mt-1 text-xs text-steel">{new Date(report.createdAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function ReportList({ reports, onSelect }: { reports: Inspection[]; onSelect: (report: Inspection) => void }) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inspections</h2>
        <FileSearch className="h-5 w-5 text-signal" />
      </div>
      <div className="max-h-[520px] divide-y divide-slate-100 overflow-auto">
        {reports.map((report) => (
          <button key={report._id} className="block w-full py-3 text-left hover:bg-slate-50" onClick={() => onSelect(report)}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">{report.inspectionId}</span>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${report.status === "completed" ? "bg-emerald-50 text-signal" : "bg-slate-100 text-steel"}`}>{report.status.replace("_", " ")}</span>
            </div>
            <p className="mt-1 text-xs text-steel">{report.header?.truckSerialNumber || "No serial"} - {report.header?.customerName || "No customer"}</p>
          </button>
        ))}
      </div>
    </aside>
  );
}

function buildPrompt(question: Question) {
  const choices = question.options ? ` Choices are ${question.options.join(", ")}.` : "";
  const unit = question.unit ? ` Give the value in ${question.unit}.` : "";
  const image = question.imageOnYes ? " If there is an issue, mention it clearly." : "";
  return `${question.label}.${choices}${unit}${image} Please speak your answer now.`;
}

function buildHeaderPrompt(question: Question) {
  const example = question.example ? ` Example: ${question.example}.` : "";
  return `${question.label}.${example} Please speak the value now.`;
}

function defaultFinding(question?: Question) {
  if (!question) return "";
  if (question.type === "yesno") return "No";
  if (question.options?.length) return question.options[0];
  return "";
}

function cleanHeaderTranscript(value: string) {
  return value.replace(/\b(ok|okay|record|next|done|complete)\b/gi, "").trim();
}

function cleanSpokenAnswer(value: string) {
  return value.replace(/\b(record|next|done|complete)\b/gi, "").trim();
}

function isAffirmative(value: string) {
  return /\b(yes|yeah|correct|right|confirm|confirmed|ok|okay)\b/i.test(value);
}

function isNegative(value: string) {
  return /\b(no|nope|wrong|incorrect|retry|again|correct it|change)\b/i.test(value);
}

function getNextPosition(sectionIndex: number, questionIndex: number, items: TemplateSection[]) {
  const section = items[sectionIndex];
  if (!section) return null;
  if (questionIndex < section.questions.length - 1) return { sectionIndex, questionIndex: questionIndex + 1 };
  if (sectionIndex < items.length - 1) return { sectionIndex: sectionIndex + 1, questionIndex: 0 };
  return null;
}

function voiceStatusLabel(phase: string, recording: boolean) {
  if (recording) return "Listening";
  const labels: Record<string, string> = {
    idle: "Ready",
    prompting: "Prompting",
    listening: "Listening",
    confirming: "Waiting for yes/no",
    retrying: "Retrying",
    saving: "Saving",
    moving: "Moving next",
    complete: "Validation mode"
  };
  return labels[phase] ?? "Ready";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-steel">{label}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function Severity({ severity }: { severity: Finding["severity"] }) {
  const styles = {
    normal: "bg-emerald-50 text-signal",
    warning: "bg-amber-50 text-caution",
    critical: "bg-red-50 text-danger"
  };

  return <span className={`inline-flex justify-center rounded-md px-2 py-1 text-xs font-semibold capitalize ${styles[severity] ?? styles.normal}`}>{severity}</span>;
}
