import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import path from "path";
import { extractTextFromPDF } from "./utils/extractText.js";
import { createVectorStore, queryVectorStore } from "./utils/vectorStore.js";

const app = express();

// ------------------------------------
// CORS
// ------------------------------------
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

// ------------------------------------
// Permanent PDF Storage Folder
// ------------------------------------
const UPLOADS_DIR = path.resolve("pdfs");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// ------------------------------------
// Multer Storage (Permanent Save)
// ------------------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    cb(null, "uploaded.pdf");
  }
});

const upload = multer({ storage });

let docStore = null;

// ------------------------------------
// Upload PDF
// ------------------------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const filePath = path.join(UPLOADS_DIR, "uploaded.pdf");

    const pages = await extractTextFromPDF(filePath);

    docStore = {
      pages,
      originalPath: filePath,
    };

    await createVectorStore(pages);

    res.json({ ok: true, pages: pages.length });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------
// Chat Endpoint
// ------------------------------------
app.post("/chat", async (req, res) => {
  try {
    const { question } = req.body;

    if (!docStore) {
      return res.status(400).json({ error: "Please upload a PDF first." });
    }

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

// ------------------------------------
// Serve Extracted Page Text (Optional)
// ------------------------------------
app.get("/pdf/:page", (req, res) => {
  if (!docStore) return res.status(404).send("No document uploaded");

  const pageIndex = parseInt(req.params.page, 10) - 1;
  const pageObj = docStore.pages[pageIndex];

  if (!pageObj) return res.status(404).send("Page not found");

  res.send(pageObj.text);
});

// ------------------------------------
// Serve Original PDF (MAIN FIX)
// ------------------------------------
app.get("/pdf-file", (req, res) => {
  if (!docStore) return res.status(404).send("No PDF uploaded.");

  const filePath = docStore.originalPath;

  // 🔥 IMPORTANT FIX: Set correct headers
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=uploaded.pdf");

  res.sendFile(filePath);
});

// ------------------------------------
// Start Server
// ------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`)
);
