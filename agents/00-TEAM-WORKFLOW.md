# Team Workflow — Jolfa Retail Gateway

> A simplified workflow for delivering Level One of Jolfa Retail Gateway in 2–3 weeks.

---

## Activation Modes

| Mode | Agents Active | Use Case | Duration |
|------|--------------|----------|----------|
| **Sprint** | 6–12 agents | Level One MVP | 2–3 weeks |
| **Micro** | 2–5 agents | Single task or bug fix | 1–3 days |

---

## Workflow Lifecycle

```
Phase 0 → Bootstrap & Context Loading
Phase 1 → Requirements & Design
Phase 2 → Architecture & Planning
Phase 3 → Foundation & Scaffolding
Phase 4 → Implementation Waves
Phase 5 → Quality Assurance & Hardening
Phase 6 → Deployment & Handoff
```

---

## Phase 0: Bootstrap

**Owner:** Technical Lead  
**Duration:** 1 day

### Actions
1. Load `01-AGENT-ROSTER.md`.
2. Read project README, `docs/level-one/ROADMAP.md`, and package.json files.
3. Confirm activation mode with the user.
4. Identify affected agents.

### Quality Gate G0
- [ ] Relevant agents identified.
- [ ] Roadmap and architecture understood.
- [ ] Activation mode confirmed.

---

## Phase 1: Requirements & Design

**Owners:** Product Manager + UX/UI Designer  
**Duration:** 1–2 days

### Actions
1. Product Manager finalizes user stories and acceptance criteria.
2. UX/UI Designer produces wireframes and design tokens.
3. Technical Lead validates feasibility.

### Deliverables
- PRD with acceptance criteria.
- Wireframes / mockups.
- Initial design system.

### Quality Gate G1
- [ ] Client approves wireframes and scope.
- [ ] Acceptance criteria are testable.

---

## Phase 2: Architecture & Planning

**Owners:** Technical Lead + Database Architect + API Architect  
**Duration:** 1 day

### Actions
1. Finalize tech choices (Express vs Fastify, Prisma vs Drizzle).
2. Design database schema and API contract.
3. Break roadmap days into tasks and assign agents.

### Deliverables
- ADRs.
- Database schema.
- OpenAPI draft.
- Task board updated.

### Quality Gate G2
- [ ] Schema covers all features.
- [ ] API contract is documented.
- [ ] Tasks are assigned.

---

## Phase 3: Foundation & Scaffolding

**Owners:** React Developer + Node.js Developer + DevOps Engineer  
**Duration:** 2–3 days

### Actions
1. Setup frontend repo with Vite, React, TypeScript, Tailwind.
2. Setup backend repo with Node.ts, framework, linting.
3. Setup PostgreSQL and initial migrations.
4. Setup GitHub Actions for lint/test.

### Deliverables
- Running frontend and backend.
- Initial migrations.
- CI pipeline.

### Quality Gate G3
- [ ] `npm run dev` works for both.
- [ ] CI passes on PR.
- [ ] Database connects successfully.

---

## Phase 4: Implementation Waves

**Owners:** All engineering agents  
**Duration:** 1–1.5 weeks

### Actions
1. Build auth, products, categories, cart, checkout.
2. Integrate payment gateway and SMS.
3. Build admin dashboard.
4. Implement static pages.

### Deliverables
- Feature PRs merged to main.
- Updated API docs.

### Quality Gate G4
- [ ] All Level One features implemented.
- [ ] Code reviewed and merged.
- [ ] Unit/integration tests pass.

---

## Phase 5: Quality Assurance & Hardening

**Owners:** QA Engineer + Security Engineer + Senior Developers  
**Duration:** 2–3 days

### Actions
1. Run exploratory tests on customer and admin flows.
2. Review auth and payment security.
3. Fix bugs and optimize mobile layout.

### Deliverables
- Test report.
- Security review notes.
- Stable release candidate.

### Quality Gate G5
- [ ] Critical paths tested.
- [ ] High-severity bugs resolved.
- [ ] Security review passed.

---

## Phase 6: Deployment & Handoff

**Owners:** DevOps Engineer + Technical Lead + Product Manager  
**Duration:** 1–2 days

### Actions
1. Deploy to Iranian VPS.
2. Configure domain, SSL, and environment variables.
3. Client training and documentation handoff.

### Deliverables
- Live site.
- Deployment runbook.
- User/admin guide.

### Quality Gate G6
- [ ] Site is live and accessible.
- [ ] Client accepts delivery.
- [ ] Documentation delivered.

---

## Communication Rules

- Daily async standup updates.
- Every PR needs one review.
- Blockers are reported within 2 hours.
- Scope changes require Product Manager approval.
