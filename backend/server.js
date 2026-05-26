import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { extractTextFromPDF } from "./utils/extractText.js";
import { createVectorStore, queryVectorStore } from "./utils/vectorStore.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

let docStore = null; // will hold { pages: [{text, page}], originalPath }

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const pages = await extractTextFromPDF(filePath);
    docStore = { pages, originalPath: filePath };
    await createVectorStore(pages); // simple in-memory vector store
    res.json({ ok: true, pages: pages.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;
    if (!docStore) return res.status(400).json({ error: "Upload a PDF first." });

    // Retrieve most relevant pages (simple keyword match fallback)
    const contexts = await queryVectorStore(question);

    // NOTE: This project scaffold does not call a real LLM.
    // It returns a combined context and instructs the user how to plug Gemini/OpenAI.
    const answer = `Pretend-LLM response (demo): I found ${contexts.length} relevant page(s). See citations.\n\nContext excerpts:\n` +
      contexts.map(c => `Page ${c.page}: ${c.text.slice(0,200).replace(/\n/g,' ')}...`).join("\n\n");

    res.json({
      answer,
      citations: contexts.map(c => c.page)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/pdf/:page", (req, res) => {
  // Simple endpoint to return raw page text for demo/scrolling integration
  const p = parseInt(req.params.page || "1", 10);
  if (!docStore) return res.status(404).send("No document uploaded");
  const pageObj = docStore.pages[Math.max(0, p - 1)];
  if (!pageObj) return res.status(404).send("Page not found");
  res.send(pageObj.text);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
