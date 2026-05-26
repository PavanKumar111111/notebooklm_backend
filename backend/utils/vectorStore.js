/**
 * Minimal in-memory 'vector store' for demo purposes.
 * It does simple keyword scoring and returns top matches with page numbers.
 *
 * To replace with a production vector DB:
 * - generate embeddings with Gemini / OpenAI
 * - store in Pinecone / Supabase / Weaviate
 * - implement similarity search
 */

let INDEX = []; // [{ text, page, tokens }]

export async function createVectorStore(pages) {
  INDEX = pages.map(p => ({ text: p.text, page: p.page }));
  return true;
}

export async function queryVectorStore(query) {
  if (!query || query.trim() === "") return [];
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  // score pages by keyword overlap
  const scored = INDEX.map(item => {
    const words = item.text.toLowerCase();
    let score = 0;
    for (const w of q) if (words.includes(w)) score++;
    return { ...item, score };
  });
  scored.sort((a,b)=>b.score-a.score);
  // return top 3 relevant pages (non-zero score). If all zero, return first page as fallback.
  const nonzero = scored.filter(s=>s.score>0);
  const top = nonzero.length ? nonzero.slice(0,3) : (scored.slice(0,1));
  return top;
}
