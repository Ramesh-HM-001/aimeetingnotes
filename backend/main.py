# ======================================================
#  AUTOMATED MEETING SUMMARIZER — SMART BACKEND
# ======================================================

import io
import os
import subprocess
import tempfile
import textwrap
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import whisper
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Automated Meeting Summarizer API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- MODEL SETUP ----------

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "tiny")
whisper_model = whisper.load_model(WHISPER_MODEL_NAME)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY is not set")

genai.configure(api_key=GEMINI_API_KEY)

gemini_model = genai.GenerativeModel("gemini-2.0-flash")


# ---------- Safe Extraction ----------

def extract_text(response):
    """Safely extract plain text from Gemini responses."""
    try:
        if hasattr(response, "text") and response.text:
            return response.text.strip()
    except Exception:
        pass
    try:
        return response.candidates[0].content.parts[0].text.strip()
    except Exception:
        return ""


# ---------- File helpers ----------

def is_video_file(filename: str | None, content_type: str | None) -> bool:
    video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
    if filename and Path(filename).suffix.lower() in video_exts:
        return True
    if content_type and content_type.startswith("video/"):
        return True
    return False


def extract_audio_with_ffmpeg(input_path: str, output_path: str) -> None:
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        output_path,
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def transcribe_with_whisper_local(upload: UploadFile, file_bytes: bytes) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        if is_video_file(upload.filename, upload.content_type):
            input_ext = Path(upload.filename or "input").suffix or ".mp4"
            input_path = tmpdir_path / f"input{input_ext}"
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            audio_path = tmpdir_path / "audio.wav"
            extract_audio_with_ffmpeg(str(input_path), str(audio_path))
            result = whisper_model.transcribe(str(audio_path))
        else:
            input_ext = Path(upload.filename or "audio").suffix or ".wav"
            input_path = tmpdir_path / f"audio{input_ext}"
            with open(input_path, "wb") as f:
                f.write(file_bytes)

            result = whisper_model.transcribe(str(input_path))

    return result.get("text", "").strip()


# ---------- SMART SUMMARIES ----------

def summarize_main(transcript: str, language: str) -> str:
    """
    Main meeting summary in user-selected language.
    """
    prompt = f"""
Summarize the following meeting in {language}.

Include clearly:
- Key discussion points
- Decisions taken
- Action items
- Deadlines / timelines
- Responsibilities / owners

Keep it concise but complete.

TRANSCRIPT:
{transcript}
"""
    response = gemini_model.generate_content(prompt)
    return extract_text(response)


def summarize_focused(transcript: str, focus_prompt: str) -> str:
    """
    Focused summary:
    - Only concepts requested by user (conceptual prompt)
    - Always in English
    - Bullet-only
    - No intro, no apologies, no explanation
    """
    prompt = f"""
You are an expert meeting insight extraction engine.

USER CONCEPT PROMPT (FOCUS TOPICS):
{focus_prompt}

YOUR JOB:
Extract ONLY the information from the meeting that is relevant to the user's conceptual topics above.
Examples of conceptual topics: "deadlines and responsibilities", "actions and decisions", "risks",
"budget approvals", "client complaints", etc.

You MUST:
- Identify decisions related to the focus topics
- Identify responsibilities and owners related to the focus topics
- Identify action items related to the focus topics
- Identify deadlines or timelines if they are mentioned or clearly implied
- Use the transcript content and reasonable inference (never random guessing)
- Ignore all unrelated conversation

STRICT OUTPUT RULES:
- OUTPUT MUST ALWAYS BE IN ENGLISH
- OUTPUT MUST BEGIN IMMEDIATELY WITH BULLET POINTS (• ...)
- DO NOT write any introduction, explanation, or commentary
- DO NOT say things like "Here is", "Okay", "I will", "Based on"
- DO NOT apologize
- DO NOT refuse
- DO NOT mention the transcript itself
- DO NOT hallucinate facts that are not supported or reasonably implied

BULLET FORMAT:
- Each bullet should be a complete, meaningful line, for example:
  • David will contact external market research firms before the next meeting
  • Anna is responsible for reviewing the customer account lifecycle
  • Decision: the team will investigate the root cause of the sales decline
  • Deadline: shortlist of vendors must be ready as soon as possible

IF THERE IS NO CLEAR, RELEVANT INFORMATION:
- Output exactly ONE bullet:
  • No relevant information was found in the meeting for the requested focus topics

TRANSCRIPT:
{transcript}
"""
    response = gemini_model.generate_content(prompt)
    text = extract_text(response).strip()

    # Safety fallback: if model ignored instructions and gave empty or non-bulleted text
    if not text:
        return "• No relevant information was found in the meeting for the requested focus topics"

    # Ensure it starts with bullet "•"
    if not text.lstrip().startswith("•"):
        # Try to split lines and convert to bullets
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return "• No relevant information was found in the meeting for the requested focus topics"
        bullet_lines = []
        for line in lines:
            if not line.startswith("•"):
                bullet_lines.append(f"• {line}")
            else:
                bullet_lines.append(line)
        return "\n".join(bullet_lines)

    return text


# ---------- Structured Insights ----------

def extract_structured_insights(transcript: str) -> dict:
    """
    Extract structured actions/decisions/owners/risks as JSON.
    """
    prompt = f"""
Extract structured meeting intelligence from the transcript.

OUTPUT JSON EXACTLY IN THIS FORMAT:
{{
  "actions": [
    {{ "task": "...", "owner": "...", "deadline": "..." }}
  ],
  "decisions": ["..."],
  "owners": [
    {{ "person": "...", "responsibility": "..." }}
  ],
  "risks": ["..."]
}}

RULES:
- Infer missing information if implied (e.g., "you check this" → assign to speaker)
- Leave fields as empty strings "" if unknown (do NOT invent)
- No apologies
- No explanations
- ONLY return valid JSON that matches the structure above.

TRANSCRIPT:
{transcript}
"""
    response = gemini_model.generate_content(prompt)
    extracted = extract_text(response)

    import json
    try:
        return json.loads(extracted)
    except Exception:
        return {"actions": [], "decisions": [], "owners": [], "risks": []}


# ---------- Diarization ----------

def generate_diarized_transcript(transcript: str) -> str:
    """
    Simple speaker label inference.
    """
    prompt = f"""
Rewrite the transcript with inferred speaker labels like Speaker 1, Speaker 2, etc.

Example format:
Speaker 1: ...
Speaker 2: ...
Speaker 1: ...

TRANSCRIPT:
{transcript}
"""
    response = gemini_model.generate_content(prompt)
    return extract_text(response)


# ---------- API Endpoint ----------

@app.post("/api/process")
async def process_meeting(
    audio: UploadFile = File(...),
    language: str = Form("English"),
    focus_prompt: str = Form(""),
):
    # Read file bytes
    try:
        file_bytes = await audio.read()
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Failed to read file: {e}"})

    # Transcription
    try:
        transcript_text = transcribe_with_whisper_local(audio, file_bytes)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Transcription failed: {e}"})

    # Summaries and insights
    try:
        # Main summary in selected language
        summary = summarize_main(transcript_text, language)

        # Focused summary in English based on conceptual prompt
        focused_summary = ""
        if focus_prompt.strip():
            focused_summary = summarize_focused(transcript_text, focus_prompt.strip())

        # Structured insights
        structured = extract_structured_insights(transcript_text)

        # Diarized transcript
        diarized = generate_diarized_transcript(transcript_text)

        return {
            "summary": summary,
            "focused_summary": focused_summary,
            "actions": structured.get("actions", []),
            "decisions": structured.get("decisions", []),
            "owners": structured.get("owners", []),
            "risks": structured.get("risks", []),
            "transcript": transcript_text,
            "diarized": diarized,
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Processing failed: {e}"})


@app.get("/health")
async def health():
    return {"status": "ok"}
