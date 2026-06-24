# AI RAG Chatbot — Employee Handbook Assistant

A Retrieval-Augmented Generation (RAG) chatbot that answers questions from an
uploaded employee handbook. Upload a PDF/TXT, it gets chunked, embedded with
Google Gemini, and stored in MongoDB Atlas. The chat UI retrieves the most
relevant chunks via Atlas Vector Search and grounds Gemini's answers in them.

- **backend/** — NestJS API (ingestion, vector search, chat, content filtering)
- **frontend/** — Next.js (App Router, TypeScript, Tailwind) chat + upload UI

---

## Prerequisites

- **Node.js** 20+ (tested on Node 25)
- **pnpm** 10+ — `npm install -g pnpm`
- **MongoDB Atlas** cluster (required for `$vectorSearch`; a local/community
  MongoDB will not work for the chat endpoint)
- **Google Gemini API key** — https://aistudio.google.com/apikey

---

## 1. Configure environment variables

### `backend/.env`

```env
MONGODB_URI=<your-mongodb-atlas-connection-string>
GEMINI_API_KEY=<your-gemini-api-key>
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> `.env*` files are git-ignored. `.env.example` files in each folder show the
> required keys.

---

## 2. Set up the MongoDB Atlas Vector Search index

The chat endpoint runs a `$vectorSearch` aggregation, which requires an Atlas
vector index named **`vector_index`** on the `chunks` collection.

In the Atlas UI: **Atlas Search → Create Search Index → JSON Editor →
Vector Search**, target the `chunks` collection, and use:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
```

> `768` matches the output dimension of Gemini's `text-embedding-004` model.
> Document upload/ingestion works without this index — only `/rag/chat` needs it.

---

## 3. Install dependencies

```bash
# from the project root
cd backend  && pnpm install
cd ../frontend && pnpm install
```

---

## 4. Run both apps (development)

Open **two terminals**.

**Terminal 1 — backend** (NestJS, port `3001`):

```bash
cd backend
pnpm run start:dev
```

**Terminal 2 — frontend** (Next.js, port `3000`):

```bash
cd frontend
pnpm run dev
```

Then open:

- **Chat UI** → http://localhost:3000
- **Upload page** → http://localhost:3000/upload
- **API** → http://localhost:3001

CORS is enabled on the backend, so the frontend can call it directly.

---

## 5. Try it

1. Go to http://localhost:3000/upload and upload a handbook PDF/TXT.
   Wait for the "Ingested N chunks from …" confirmation.
2. Go to http://localhost:3000 and ask a question about the handbook.
   Answers cite their source document(s) and stay grounded in the handbook.

---

## API endpoints

| Method   | Route                | Body / Params                          | Description                              |
| -------- | -------------------- | -------------------------------------- | ---------------------------------------- |
| `POST`   | `/rag/upload`        | `multipart/form-data` with `file`      | Parse, chunk, embed & store a document   |
| `POST`   | `/rag/chat`          | `{ "question": str, "sessionId": str }`| Ask a grounded question                  |
| `DELETE` | `/rag/session/:id`   | `:id` = session id                     | Clear a chat session's history           |

---

## Production build

```bash
# backend
cd backend && pnpm run build && pnpm run start:prod

# frontend
cd frontend && pnpm run build && pnpm run start
```

---

## Project structure

```
ai-rag-chatbot/
├── backend/                 # NestJS API
│   └── src/
│       ├── main.ts          # port 3001, CORS enabled
│       ├── app.module.ts    # ConfigModule + MongooseModule (async) + RagModule
│       └── rag/
│           ├── chunk.schema.ts
│           ├── session.schema.ts
│           ├── filters.service.ts   # profanity / prompt-injection guard
│           ├── rag.service.ts       # ingest, embed, vector search, chat
│           ├── rag.controller.ts    # /rag/upload, /rag/chat, /rag/session/:id
│           └── rag.module.ts
└── frontend/                # Next.js (App Router)
    └── src/
        ├── lib/session.ts   # per-tab session id (sessionStorage)
        └── app/
            ├── page.tsx      # chat UI
            └── upload/page.tsx
```

---

## Troubleshooting

- **`/rag/chat` returns 500 / `$vectorSearch` errors** — the Atlas
  `vector_index` (step 2) is missing or still building, or you're not pointed at
  an Atlas cluster.
- **Empty / "out of scope" answers** — no document has been ingested yet, or no
  chunk scored above the `0.70` relevance threshold. Upload a relevant document.
- **Frontend can't reach the API** — confirm the backend is on `3001` and
  `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches. Restart `pnpm run dev`
  after changing env vars (they're inlined at build/start time).
- **Gemini rate limits** — ingestion pauses 1s after every 10 chunks to respect
  the free-tier limit; large documents will take a little longer.
