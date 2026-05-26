import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { extractTextFromPDF } from "./utils/extractText.js";
import { createVectorStore, queryVectorStore } from "./utils/vectorStore.js";

const app = express();

// ✅ CORS FIXED — supports Netlify & local dev
app.use(
  cors({
    origin: [
      "https://pvnsmartnotes.netlify.app",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  })
);

app.use(express.json());

// 🔹 Multer Upload Config (stores PDFs in /uploads)
const upload = multer({ dest: "uploads/" });

let docStore = null; // will hold { pages: [], originalPath: "" }

// =========================
//     📌 UPLOAD PDF
// =========================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ ok: false, error: "No file uploaded" });

    const filePath = req.file.path;

    // Extract text from the PDF
    const pages = await extractTextFromPDF(filePath);

    docStore = { pages, originalPath: filePath };

    await createVectorStore(pages);

    res.json({ ok: true, pages: pages.length });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// =========================
//         📌 CHAT
// =========================
app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;

    if (!docStore)
      return res.status(400).json({ error: "Please upload a PDF first." });

    const contexts = await queryVectorStore(question);

    const answer =
      `Pretend-LLM response:\nFound ${contexts.length} relevant page(s).\n\n` +
      contexts
        .map(
          (c) =>
            `Page ${c.page}: ${c.text.slice(0, 200).replace(/\n/g, " ")}...`
        )
        .join("\n\n");

    res.json({
      answer,
      citations: contexts.map((c) => c.page)
    });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
//   📌 RETURN PAGE TEXT
// =========================
app.get("/pdf/:page", (req, res) => {
  if (!docStore) return res.status(404).send("No document uploaded");

  const pageIndex = parseInt(req.params.page, 10) - 1;

  const pageObj = docStore.pages[pageIndex];

  if (!pageObj) return res.status(404).send("Page not found");

  res.send(pageObj.text);
});

// =========================
//      📌 SERVER START
// =========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`)
);
