import React, { useState } from "react";
import { supabase } from "../App";
import { parseCSVFile, extractTextFromPDFFile, extractCandidateNamesFromText, normalizeName } from "../utils";

export default function UploadStatement() {
  const [files, setFiles] = useState(null);
  const [status, setStatus] = useState("");

  async function handleUpload(e) {
    setFiles(e.target.files);
  }

  async function processUploads() {
    if (!files || files.length === 0) return alert("Select files first");
    setStatus("Processing...");
    for (const file of files) {
      const id = Date.now() + "-" + file.name;
      const path = `statements/${id}`;

      // store file in Supabase Storage
      const { error: upErr } = await supabase.storage.from("statements").upload(path, file);
      if (upErr) {
        console.error(upErr);
        setStatus("Upload error: " + upErr.message);
        return;
      }

      // extract text depending on file type
      let text = "";
      if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel") {
        const parsed = await parseCSVFile(file);
        const candidates = [];
        for (const row of parsed) {
          for (const k of Object.keys(row)) {
            const v = (row[k] || "").toString().trim();
            if (v && /[A-Za-z]/.test(v) && v.length < 120) {
              candidates.push(v);
            }
          }
        }
        text = candidates.join("\n");
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractTextFromPDFFile(file);
      } else {
        text = await file.text();
      }

      // save statement record
      const { data: statementRec, error: stmtErr } = await supabase.from("statements").insert([{ storage_path: path, filename: file.name, raw_text: text }]).select().single();
      if (stmtErr) {
        console.error(stmtErr);
        setStatus("DB error: " + stmtErr.message);
        return;
      }

      // extract candidate names and insert bets
      const names = extractCandidateNamesFromText(text);
      const rows = names.map((n) => ({ statement_id: statementRec.id, horse_name_raw: n, normalized_name: normalizeName(n) }));
      if (rows.length > 0) {
        const { error: betErr } = await supabase.from("bets").insert(rows);
        if (betErr) {
          console.error(betErr);
          setStatus("DB error: " + betErr.message);
          return;
        }
      }
    }
    setStatus("Finished processing all files.");
  }

  return (
    <div>
      <h3>Upload Statement(s)</h3>
      <div>
        <input type="file" multiple onChange={handleUpload} />
        <button onClick={processUploads} style={{ marginLeft: 8 }}>Upload & Process</button>
      </div>
      <div style={{ marginTop: 8 }}>{status}</div>
      <p style={{ color: "#666", fontSize: 13 }}>Accepts CSV or PDF statements from bookies. Best if PDFs contain selectable text (not images).</p>
    </div>
  );
}
