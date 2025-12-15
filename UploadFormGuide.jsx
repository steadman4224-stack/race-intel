UploadFormGuideimport React, { useState } from "react";
import { supabase } from "../App";
import { parseCSVFile, extractTextFromPDFFile, extractCandidateNamesFromText, normalizeName } from "../utils";

export default function UploadFormGuide() {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  async function handleFile(e) {
    setFile(e.target.files?.[0]);
  }

  async function processFormGuide() {
    setMsg("Processing...");
    let raw = text || "";
    if (!raw && file) {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const parsed = await parseCSVFile(file);
        const rows = [];
        for (const r of parsed) {
          for (const k of Object.keys(r)) {
            const v = (r[k] || "").toString().trim();
            if (v && /[A-Za-z]/.test(v)) rows.push(v);
          }
        }
        raw = rows.join("\n");
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        raw = await extractTextFromPDFFile(file);
      } else {
        raw = await file.text();
      }
    }
    if (!raw) {
      setMsg("No form guide text or file provided.");
      return;
    }

    // save form_guide
    const { data: fg, error: fgErr } = await supabase.from("form_guides").insert([{ raw_text: raw }]).select().single();
    if (fgErr) {
      setMsg("DB error: " + fgErr.message);
      return;
    }

    const names = extractCandidateNamesFromText(raw);
    const rows = names.map((n, idx) => ({ form_guide_id: fg.id, horse_name_raw: n, normalized_name: normalizeName(n), race_position: idx + 1 }));
    if (rows.length > 0) {
      const { error: ghErr } = await supabase.from("guide_horses").insert(rows);
      if (ghErr) {
        setMsg("DB error: " + ghErr.message);
        return;
      }
    }

    setMsg("Form guide saved. Use Dashboard to view matches.");
  }

  return (
    <div>
      <h3>Upload / Paste Form Guide</h3>
      <p>Paste form guide text or upload PDF/CSV from Racing Australia (paste is easiest).</p>
      <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%" }} placeholder="Paste form guide text here..." />
      <div style={{ marginTop: 8 }}>
        <input type="file" onChange={handleFile} />
        <button onClick={processFormGuide} style={{ marginLeft: 8 }}>Save Form Guide</button>
      </div>
      <div style={{ marginTop: 8 }}>{msg}</div>
    </div>
  );
}
