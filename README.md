# ai Chat — Branching AI Conversations + Resume Analyzer

A production-ready Next.js 16 app featuring:

- **Tree-based chat branching** (like ChatGPT / Gemini): edit a prompt or regenerate an AI reply to create alternate branches, then switch between them with `< 1/2 >` arrows.
- **AI Resume Analyzer**: upload a PDF / DOCX / TXT resume for an instant ATS score with strengths, weaknesses, and suggestions.
- **Auth**: register / login / session validation with JWT (scrypt hashing, no native deps).
- **Chat history sidebar**: conversations grouped by Today / Yesterday / Previous 7 Days / Older; rename and delete.
- **Dark / light theme**, fully responsive, error-bounded.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons |
| Database | Prisma ORM (SQLite for local dev → PostgreSQL for Vercel) |
| @google/generative-ai` (local PC / Vercel) |
| State | Zustand (client) + TanStack Query (server) |
| Auth | JWT (HS256 via Node crypto) + scrypt password hashing |

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in your values
cp  .env
#   → Set AI_PROVIDER=gemini and GEMINI_API_KEY=your-key

# 3. Create the database
npm run db:push

# 4. Start dev server
npm  run dev
```

Open `http://localhost:3000`, register an account, and start chatting.

## Deploy to Vercel

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the complete step-by-step guide.

## Project Structure

```
src/
├── app/
│   ├── api/                    # REST API routes
│   │   ├── auth/               # register, login, me
│   │   ├── resume/             # upload+analyze, history
│   │   └── chat/               # session CRUD + message (branching)
│   ├── layout.tsx
│   └── page.tsx                # single-page app entry
├── components/
│   ├── app/                    # feature components
│   └── ui/                     # shadcn/ui primitives
├── hooks/                      # TanStack Query hooks
└── lib/
    ├── ai.ts                   # dual-provider AI (Zai / Gemini)
    ├── auth.ts                 # JWT + scrypt
    ├── api.ts                  # response envelope + requireUser
    ├── chat-tree.ts            # server-side branching logic
    ├── tree-utils.ts           # client-side branch navigation
    └── types.ts                # shared domain types
prisma/
└── schema.prisma               # User, Resume, ChatSession, Message
```

## Branching Chat — How It Works

Every message stores a `parentMessageId`, `siblingIndex`, and `childrenIds`. This forms a tree:

- **Send a message** → attaches to the active leaf.
- **Edit a prompt** → creates a sibling user message (new branch) + generates a new AI reply.
- **Regenerate a reply** → creates a sibling assistant message from the same parent.
- **`< 1/2 >` arrows** → switch between sibling branches; the visible path updates from root to the selected leaf.
