# AI RAG Chatbot — Employee Handbook Assistant

A Retrieval-Augmented Generation (RAG) chatbot that answers questions from an
uploaded employee handbook. Upload a PDF/TXT, it gets chunked, embedded with
Google Gemini, and stored in MongoDB Atlas. The chat UI retrieves the most
relevant chunks via Atlas Vector Search and grounds Gemini's answers in them.

Access is protected by JWT authentication with two roles: **admin** (upload and
delete handbooks) and **employee** (chat only).

- **backend/** — NestJS API (auth, ingestion, vector search, chat, content filtering)
- **frontend/** — Next.js (App Router, TypeScript, Tailwind) login + chat + upload UI

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

# Auth
JWT_SECRET=<a-long-random-secret>
JWT_EXPIRES_IN=1d
# A default admin is auto-seeded on first startup using these credentials:
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

> **Security:** change `JWT_SECRET` to a long random value and set a strong
> `ADMIN_PASSWORD` before deploying. The seeded admin is only created if no user
> with that email already exists.

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

> `768` matches the output dimension we request from Gemini's
> `gemini-embedding-001` model (pinned via `outputDimensionality: 768`).
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

- **Login** → http://localhost:3000/login
- **Chat UI** → http://localhost:3000
- **Upload page** (admins only) → http://localhost:3000/upload
- **API** → http://localhost:3001

CORS is enabled on the backend, so the frontend can call it directly.

---

## 5. Log in


| Field    | Default value       |
| -------- | ------------------- |
| Email    | `admin@example.com` |
| Password | `admin123`          |
| Email.   | `emp@example.com`   |
| Password |`emp123`             |

1. Go to http://localhost:3000/login and sign in with the admin credentials
   above .
2. Visiting any page without a valid token redirects you here.

### Roles

| Role         | Can do                                            |
| ------------ | ------------------------------------------------- |
| **admin**    | Everything below **plus** upload / delete handbooks |
| **employee** | Chat and clear their own session only             |

Admins create more users via `POST /auth/register` (see the API table). New
users default to the **employee** role unless `role: "admin"` is specified.

---

## 6. Try it

1. As an **admin**, open http://localhost:3000/upload and upload a handbook
   PDF/TXT. Wait for the "Ingested N chunks from …" confirmation.
2. Go to http://localhost:3000 and ask a question about the handbook.
   Answers cite their source document(s) and stay grounded in the handbook.
3. Employees can chat but won't see the Upload link and are blocked (403) from
   uploading.

---

## API endpoints

All `/rag/*` routes require a `Authorization: Bearer <token>` header.

| Method   | Route                  | Access     | Body / Params                           | Description                            |
| -------- | ---------------------- | ---------- | --------------------------------------- | -------------------------------------- |
| `POST`   | `/auth/login`          | public     | `{ "email": str, "password": str }`     | Returns `{ access_token, user }`       |
| `POST`   | `/auth/register`       | admin      | `{ "email", "password", "role"? }`      | Create a user (default role: employee) |
| `GET`    | `/auth/me`             | any (auth) | —                                       | Current user from the token            |
| `POST`   | `/rag/upload`          | admin      | `multipart/form-data` with `file`       | Parse, chunk, embed & store a document |
| `DELETE` | `/rag/document/:source`| admin      | `:source` = filename                    | Delete all chunks for a document       |
| `POST`   | `/rag/chat`            | any (auth) | `{ "question": str, "sessionId": str }` | Ask a grounded question                |
| `DELETE` | `/rag/session/:id`     | any (auth) | `:id` = session id                      | Clear a chat session's history         |

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
│       ├── app.module.ts    # ConfigModule + MongooseModule (async) + AuthModule + RagModule
│       ├── auth/
│       │   ├── user.schema.ts        # email / password (bcrypt) / role
│       │   ├── auth.service.ts       # login, register, seed default admin
│       │   ├── auth.controller.ts    # /auth/login, /auth/register, /auth/me
│       │   ├── jwt-auth.guard.ts     # verifies Bearer token
│       │   ├── roles.guard.ts        # enforces @Roles()
│       │   ├── roles.decorator.ts    # @Roles(...) + roles.enum.ts
│       │   └── auth.module.ts
│       └── rag/
│           ├── chunk.schema.ts
│           ├── session.schema.ts
│           ├── filters.service.ts   # profanity / prompt-injection guard
│           ├── rag.service.ts       # ingest, embed, vector search, chat
│           ├── rag.controller.ts    # guarded /rag routes
│           └── rag.module.ts
└── frontend/                # Next.js (App Router)
    └── src/
        ├── lib/
        │   ├── session.ts   # per-tab chat session id (sessionStorage)
        │   └── auth.ts      # token / role storage + auth headers
        └── app/
            ├── login/page.tsx
            ├── page.tsx      # chat UI (auth-gated)
            └── upload/page.tsx  # admin-only
```

---
