import fs from "fs";
import pdf from "pdf-parse";

/**
 * Extracts text per page from PDF.
 * Returns array of { text, page }.
 */
export async function extractTextFromPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  // pdf-parse returns text but not page-split by default; this simple approach splits by form feed.
  const data = await pdf(dataBuffer);
  // A rough split: try to split by '\f' or double newlines as fallback.
  const raw = data.text || "";
  const pages = raw.split('\f').map((p, i) => ({ text: p.trim(), page: i + 1 }));
  // If splitting produced a single page, try heuristic split by longpage separators.
  if (pages.length === 1) {
    const lines = raw.split('\n');
    const chunkSize = 300; // characters
    const out = [];
    let buf = "";
    let page = 1;
    for (const line of lines) {
      buf += line + "\n";
      if (buf.length > chunkSize) {
        out.push({ text: buf, page: page++ });
        buf = "";
      }
    }
    if (buf.trim()) out.push({ text: buf, page: page++ });
    return out;
  }
  return pages;
}
