# Agent Roster — Jolfa Retail Gateway

> Curated list of agents for the Level One implementation of Jolfa Retail Gateway.

---

## How to Read This Roster

| Column | Meaning |
|--------|---------|
| **Agent** | Display name and link to file |
| **Category** | Functional division |
| **Emoji** | Visual tag |
| **Vibe** | One-line personality |
| **Typical Tasks** | When to activate |
| **Active in Level One** | Whether this agent is needed in phase one |

---

## Leadership

| Agent | Category | Emoji | Vibe | Typical Tasks | Active in Level One |
|-------|----------|-------|------|---------------|---------------------|
| [Technical Lead](technical-lead.md) | leadership | 🧭 | Owns delivery and unblocks the team. | Architecture, task decomposition, code reviews | ✅ Yes |
| [Product Manager](product-manager.md) | product | 📋 | Ships the right thing on time. | PRDs, user stories, prioritization | ✅ Yes |
| [UX/UI Designer](ux-ui-designer.md) | design | 🎨 | Defends users and polishes pixels. | Wireframes, mockups, design system | ✅ Yes |

## Engineering — Frontend

| Agent | Category | Emoji | Vibe | Typical Tasks | Active in Level One |
|-------|----------|-------|------|---------------|---------------------|
| [React Developer](react-developer.md) | engineering-web | ⚛️ | Deep in hooks, state, and component patterns. | React UI, routing, forms, cart | ✅ Yes |
| [Senior Frontend Developer](senior-frontend-developer.md) | engineering-web | 💎 | Owns hard UI problems and mentors. | Architecture, complex components, review | ✅ Yes |

## Engineering — Backend

| Agent | Category | Emoji | Vibe | Typical Tasks | Active in Level One |
|-------|----------|-------|------|---------------|---------------------|
| [Node.js Developer](nodejs-developer.md) | engineering-backend | 🟩 | Expert in the server runtime. | Express/Fastify, auth, payment integration | ✅ Yes |
| [Senior Backend Developer](senior-backend-developer.md) | engineering-backend | 🛡️ | Builds systems that don't fall over. | APIs, domain logic, security | ✅ Yes |
| [Database Architect](database-architect.md) | engineering-backend | 🗄️ | Models data for correctness. | PostgreSQL schema, migrations, queries | ✅ Yes |
| [API Architect](api-architect.md) | engineering-backend | 🔌 | Designs contracts both sides love. | REST design, OpenAPI specs | ✅ Yes |

## Engineering — Platform & QA

| Agent | Category | Emoji | Vibe | Typical Tasks | Active in Level One |
|-------|----------|-------|------|---------------|---------------------|
| [DevOps Engineer](devops-engineer.md) | engineering-platform | 🚀 | Automates commit to production. | CI/CD, VPS deployment, GitHub Actions | ✅ Yes |
| [QA Engineer](qa-engineer.md) | quality | 🧪 | Quality gatekeeper. | Test strategy, acceptance tests, regression | ✅ Yes |
| [Security Engineer](security-engineer.md) | security | 🛡️ | Thinks like an attacker. | Auth review, payment security, hardening | ⚠️ Advisory |

## Inactive in Level One

These agents may be activated in later phases:

- AI/ML Engineer
- Mobile Developer
- Blockchain Developer
- Data Scientist
- Performance Test Engineer

---

## Activation Quick Reference

| Task Type | Suggested Agents |
|-----------|------------------|
| New frontend feature | Product Manager, UX/UI Designer, React Developer, Senior Frontend |
| New backend feature | Product Manager, Node.js Developer, Senior Backend, Database Architect |
| Payment integration | Node.js Developer, Security Engineer, QA Engineer |
| Deployment | DevOps Engineer, Technical Lead |
| Bug fix | Relevant engineer + QA Engineer |
