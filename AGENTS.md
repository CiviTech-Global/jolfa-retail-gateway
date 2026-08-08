# Agent Instructions — Jolfa Retail Gateway

> This file governs how AI agents collaborate on the Jolfa Retail Gateway project.

---

## Project Context

**Name:** Jolfa Retail Gateway  
**Goal:** Persian RTL e-commerce MVP (Level One)  
**Duration:** 2–3 weeks  
**Stack:** React 19 + TypeScript 6 + Vite 8 + Node.ts + PostgreSQL  

---

## How to Use the Agent Roster

1. Read `agents/01-AGENT-ROSTER.md` to identify which agents are active for your task.
2. Read the specific agent file(s) you are embodying.
3. Follow the workflow in `agents/00-TEAM-WORKFLOW.md`.
4. Before writing code, read `docs/level-one/ROADMAP.md` and the relevant `package.json` files.

---

## Repository Layout

```
C:\Workspace\RTJG-clients\jolfa-retail-gateway
├── Jolfa-web/              # React + Vite frontend
├── Jolfa-Server/           # Node.ts backend
├── docs/
│   └── level-one/
│       └── ROADMAP.md      # Detailed Level One roadmap
├── agents/                 # Agent roster and workflow
│   ├── 00-TEAM-WORKFLOW.md
│   ├── 01-AGENT-ROSTER.md
│   └── *.md                # Individual agent files
├── README.md
└── AGENTS.md               # This file
```

---

## Coding Standards

- **TypeScript strict mode** on both frontend and backend.
- **Persian RTL** by default in the web app.
- **ESM** for backend modules.
- **Feature-based folder structure** for frontend.
- **Thin controllers, rich services** for backend.
- **Never commit secrets** — use `.env` files and GitHub Secrets.

---

## Quality Gates

No phase advances without passing its quality gate. See `agents/00-TEAM-WORKFLOW.md`.

---

## Communication Style

- Explain decisions briefly and clearly.
- Report progress by feature and blockers immediately.
- Ask clarifying questions when requirements are ambiguous.
- Prefer simple, maintainable solutions.
