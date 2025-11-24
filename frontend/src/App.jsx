// App.jsx
import React, { useState, useEffect } from "react";
import WaveformPlayer from "./WaveformPlayer.jsx";

const API_BASE = "http://172.22.6.216:8000"; // or http://localhost:8000

export default function App() {
  const [file, setFile] = useState(null);
  const [audioURL, setAudioURL] = useState("");
  const [language, setLanguage] = useState("English");
  const [focusPrompt, setFocusPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState("");
  const [focusSummary, setFocusSummary] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  // ✅ LIGHT/DARK THEME STATE
  const [theme, setTheme] = useState("dark");

  // ✅ THEME COLOR MAP (Option A selected)
  const themeStyles = {
    dark: {
      bg: "#0f172a",
      panel: "#020617",
      text: "#e5e7eb",
      border: "#1f2937",
      muted: "#9ca3af",
      subMuted: "#4b5563",
    },
    light: {
      bg: "#f8fafc",
      panel: "#ffffff",
      text: "#111827",
      border: "#d1d5db",
      muted: "#475569",
      subMuted: "#94a3b8",
    },
  };

  const t = themeStyles[theme];

  // Clean up URL when file changes
  useEffect(() => {
    if (!file) {
      setAudioURL("");
      return;
    }
    const url = URL.createObjectURL(file);
    setAudioURL(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setError("");
    setSummary("");
    setFocusSummary("");
    setTranscript("");
    setFile(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please upload an audio or video file first.");
      return;
    }

    setLoading(true);
    setError("");
    setSummary("");
    setFocusSummary("");
    setTranscript("");

    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("language", language);

      const enforcedFocusPrompt = focusPrompt.trim()
        ? `${focusPrompt.trim()} (Output must be ONLY in English)`
        : "Provide focused summary ONLY in English.";

      formData.append("focus_prompt", enforcedFocusPrompt);

      const res = await fetch(`${API_BASE}/api/process`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Something went wrong");
      }

      const data = await res.json();

      setSummary(data.summary || "");
      setFocusSummary(data.focused_summary || "");
      setTranscript(data.transcript || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to summarize input.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ TXT DOWNLOAD — MAIN SUMMARY
  const downloadSummaryTxt = () => {
    if (!summary) return;
    const content = `Main Summary (${language})\n\n${summary}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `summary_${language}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ✅ TXT DOWNLOAD — FOCUSED SUMMARY
  const downloadFocusedTxt = () => {
    if (!focusSummary) return;
    const content = `Focused Summary (English Only)\n\n${focusSummary}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focused_summary_english.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        color: t.text,
        display: "flex",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
          background: t.panel,
          borderRadius: "16px",
          padding: "24px",
          boxShadow:
            theme === "dark"
              ? "0 20px 40px rgba(0,0,0,0.4)"
              : "0 4px 16px rgba(0,0,0,0.08)",
          border: `1px solid ${t.border}`,
        }}
      >
        {/* HEADER */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.75rem", marginBottom: "4px" }}>
              AI Meeting Summarizer
            </h1>
            <p style={{ fontSize: "0.9rem", color: t.muted }}>
              Upload your meeting recording and get a clean summary.
            </p>
          </div>

          {/* ✅ THEME TOGGLE BUTTON IN TOP RIGHT */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={{
              padding: "8px 16px",
              borderRadius: "999px",
              border: `1px solid ${t.border}`,
              background: theme === "dark" ? "#e5e7eb" : "#0ea5e9",
              color: theme === "dark" ? "#111827" : "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {theme === "dark" ? "☀ Light Mode" : "🌙 Dark Mode"}
          </button>
        </header>

        {/* ✅ PART 1 ENDS HERE */}
        {/* WAIT FOR PART 2 BEFORE RUNNING */}
                {/* FORM & PLAYER */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.3fr)",
            gap: "24px",
          }}
        >
          {/* LEFT SIDE: Input */}
          <section
            style={{
              background: t.panel,
              borderRadius: "12px",
              border: `1px solid ${t.border}`,
              padding: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                marginBottom: "12px",
                fontWeight: 600,
                color: t.text,
              }}
            >
              1. Upload & Configure
            </h2>

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              {/* File input */}
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    marginBottom: "6px",
                    display: "block",
                    color: t.text,
                  }}
                >
                  Audio / Video file
                </label>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: `1px solid ${t.border}`,
                    background: t.panel,
                    color: t.text,
                    fontSize: "0.9rem",
                  }}
                />
                {file && (
                  <p style={{ fontSize: "0.75rem", color: t.muted }}>
                    Selected: {file.name}
                  </p>
                )}
              </div>

              {/* Language */}
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    marginBottom: "6px",
                    display: "block",
                    color: t.text,
                  }}
                >
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: `1px solid ${t.border}`,
                    background: t.panel,
                    color: t.text,
                    fontSize: "0.9rem",
                  }}
                >
                  <option>English</option>
                  <option>Hindi</option>
                  <option>Kannada</option>
                  <option>Telugu</option>
                  <option>Tamil</option>
                  <option>Malayalam</option>   {/* ✅ new */}
                   <option>Marathi</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Focus prompt */}
              <div>
                <label
                  style={{
                    fontSize: "0.85rem",
                    marginBottom: "6px",
                    display: "block",
                    color: t.text,
                  }}
                >
                  Focus prompt (optional)
                </label>
                <textarea
                  rows={3}
                  value={focusPrompt}
                  onChange={(e) => setFocusPrompt(e.target.value)}
                  placeholder="Eg: Focus on action items and deadlines, ignore small talk."
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "8px",
                    border: `1px solid ${t.border}`,
                    background: t.panel,
                    color: t.text,
                    fontSize: "0.9rem",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !file}
                style={{
                  marginTop: "4px",
                  padding: "10px 16px",
                  borderRadius: "999px",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  cursor: loading || !file ? "not-allowed" : "pointer",
                  background:
                    loading || !file
                      ? (theme === "dark"
                          ? "rgba(59,130,246,0.4)"
                          : "rgba(100,100,100,0.3)")
                      : "linear-gradient(90deg,#2563eb,#22c55e)",
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        borderRadius: "999px",
                        border: `2px solid ${t.muted}`,
                        borderTop: "2px solid transparent",
                        animation: "spin 1s linear infinite",
                      }}
                    ></span>
                    Generating summary...
                  </>
                ) : (
                  "Summarize Meeting"
                )}
              </button>

              {error && (
                <p
                  style={{
                    marginTop: "6px",
                    fontSize: "0.8rem",
                    color: "#f87171",
                  }}
                >
                  {error}
                </p>
              )}
            </form>

            {/* Audio player / waveform */}
            <div style={{ marginTop: "18px" }}>
              <h3
                style={{
                  fontSize: "0.9rem",
                  marginBottom: "8px",
                  fontWeight: 600,
                  color: t.text,
                }}
              >
                2. Preview audio
              </h3>
              {audioURL ? (
                <WaveformPlayer audioURL={audioURL} />
              ) : (
                <p style={{ fontSize: "0.8rem", color: t.subMuted }}>
                  Upload an audio file to see the waveform and controls.
                </p>
              )}
            </div>
          </section>
                  {/* RIGHT SIDE: Output */}
          <section
            style={{
              background: t.panel,
              borderRadius: "12px",
              border: `1px solid ${t.border}`,
              padding: "16px",
              maxHeight: "70vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                marginBottom: "12px",
                fontWeight: 600,
                color: t.text,
              }}
            >
              3. Summary & Notes
            </h2>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                paddingRight: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {/* Main summary */}
              <div>
                <h3
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "6px",
                    color: t.text,
                  }}
                >
                  Main Summary
                </h3>
                <div
                  style={{
                    fontSize: "0.85rem",
                    background: t.panel,
                    borderRadius: "8px",
                    border: `1px solid ${t.border}`,
                    padding: "10px",
                    whiteSpace: "pre-wrap",
                    color: t.text,
                  }}
                >
                  {loading && !summary && (
                    <span style={{ color: t.muted }}>
                      Analysing your meeting...
                    </span>
                  )}
                  {!loading && !summary && (
                    <span style={{ color: t.subMuted }}>
                      Summary will appear here after processing.
                    </span>
                  )}
                  {summary && <span>{summary}</span>}
                </div>

                {/* ✅ Download TXT */}
                <button
                  onClick={downloadSummaryTxt}
                  disabled={!summary}
                  style={{
                    marginTop: "6px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    background: theme === "dark" ? "#0ea5e9" : "#0284c7",
                    color: "white",
                    fontSize: "0.8rem",
                    cursor: !summary ? "not-allowed" : "pointer",
                    border: "none",
                  }}
                >
                  Download Summary TXT
                </button>
              </div>

              {/* Focused Summary */}
              <div>
                <h3
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "6px",
                    color: t.text,
                  }}
                >
                  Focused Summary / Action Items (English)
                </h3>
                <div
                  style={{
                    fontSize: "0.85rem",
                    background: t.panel,
                    borderRadius: "8px",
                    border: `1px solid ${t.border}`,
                    padding: "10px",
                    whiteSpace: "pre-wrap",
                    color: t.text,
                  }}
                >
                  {focusSummary ? (
                    <span>{focusSummary}</span>
                  ) : (
                    <span style={{ color: t.subMuted }}>
                      If you provide a focus prompt (e.g., “only tasks and
                      deadlines”), that custom summary will appear here.
                    </span>
                  )}
                </div>

                {/* ✅ Download TXT */}
                <button
                  onClick={downloadFocusedTxt}
                  disabled={!focusSummary}
                  style={{
                    marginTop: "6px",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    background: theme === "dark" ? "#10b981" : "#059669",
                    color: "white",
                    fontSize: "0.8rem",
                    cursor: !focusSummary ? "not-allowed" : "pointer",
                    border: "none",
                  }}
                >
                  Download Focused Summary TXT
                </button>
              </div>

              {/* Transcript */}
              <div>
                <h3
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "6px",
                    color: t.text,
                  }}
                >
                  Full Transcript (optional)
                </h3>
                <div
                  style={{
                    fontSize: "0.8rem",
                    background: t.panel,
                    borderRadius: "8px",
                    border: `1px solid ${t.border}`,
                    padding: "10px",
                    height: "150px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    color: t.text,
                  }}
                >
                  {transcript ? (
                    transcript
                  ) : (
                    <span style={{ color: t.subMuted }}>
                      Enable transcript in backend to see full text here.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ✅ spinner animation */}
        <style>
          {`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>

      </div>
    </div>
  );
}
