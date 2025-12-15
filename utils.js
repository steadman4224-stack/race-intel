import Papa from "papaparse";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.js`;

export async function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data);
      },
      error: (err) => reject(err)
    });
  });
}

export async function extractTextFromPDFFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const doc = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((s) => s.str);
    text += strings.join(" ") + "\n";
  }
  return text;
}

export function extractCandidateNamesFromText(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const candidates = [];
  const nameRe = /^\s*(?:\d{1,2}\.?)?\s*([A-Z0-9'’\-\.\(\) ]{2,80})\s*(?:\d{1,2}kg|\(|-|\s{2,}|$)/i;
  for (const ln of lines) {
    const m = ln.match(nameRe);
    if (m) {
      let name = m[1].trim();
      name = name.replace(/\s{2,}/g, " ");
      if (name.length >= 2 && name.length <= 80) {
        candidates.push(name);
      }
    } else {
      if (ln.length <= 60 && /[A-Za-z]/.test(ln) && ln.split(" ").length <= 6) {
        candidates.push(ln);
      }
    }
  }
  const seen = new Set();
  const res = [];
  for (const c of candidates) {
    if (!seen.has(c)) {
      seen.add(c);
      res.push(c);
    }
  }
  return res;
}

export function normalizeName(s) {
  if (!s) return "";
  let t = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  t = t.toLowerCase();
  t = t.replace(/\(.*?\)/g, " ");
  t = t.replace(/\b\d{1,3}kg\b/g, " ");
  t = t.replace(/\b\d+\b/g, " ");
  t = t.replace(/[^a-z0-9\-'\s]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}
