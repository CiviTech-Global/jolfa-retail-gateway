# 0.0 — What You Will Learn

By the end of this guide you will be able to:

1. Explain what runs on the Jolfa server and why (Part 0.1).
2. Read an Ansible playbook well enough to know what it will do before you run
   it (Part 0.2).
3. Take a bare Ubuntu VPS from "root password in an email" to a hardened,
   firewalled server running the store on HTTPS (Parts 1–5).
4. Hand the customer a browser dashboard from which they can redeploy, roll
   back and back up without a terminal (Part 6).
5. Diagnose the handful of things that actually go wrong in production here, and
   restore from backup when they do (Part 7).

---

## The mental model

There are three machines in this story, and confusing them is the single most
common source of "why is this not working".

| Machine | What it is | What runs on it |
|---|---|---|
| **Control machine** | Your Windows laptop, specifically the Ubuntu inside WSL | Ansible, git, your SSH key |
| **Target server** | The customer's VPS | Nginx, Node/PM2, PostgreSQL, the store |
| **The customer's browser** | Anyone visiting the shop | The React bundle Nginx served them |

Ansible runs on the **control machine** and reaches the **target server** over
SSH. Nothing is installed on the server to make that work — Ansible is
agentless. It uploads small Python programs, runs them, and removes them.

---

## What "repeatable" buys you

The manual route is documented in [`docs/level-one/DEPLOY.md`](../../level-one/DEPLOY.md)
and it works. It is thirty-odd commands typed in order. The problem is not that
typing them is slow; it is that:

- You cannot prove which of them were actually run on this particular server.
- Six months later, when the customer buys a second server or the first one
  dies, you type them again from memory and get a *slightly* different machine.
- The person who does it next is not you.

Ansible turns those commands into a file you can read, review, diff and re-run.
`provision.yml` run twice does nothing the second time — that property
(idempotence) is what makes it safe to re-run whenever anything changes.

---

## What this guide will not do

- **It will not put real money through a payment gateway.** ZarinPal stays in
  sandbox. Flipping it is one variable, and [going-live.md](../08-reference/going-live.md)
  covers the full checklist — but that is a decision the customer makes after
  their merchant contract is signed.
- **It will not send real SMS.** Both provider keys stay empty, which makes the
  server log password-reset codes instead of sending them. Correct for a store
  that has not bought a sender line.
- **It will not set up a second server, a load balancer or a CDN.** One VPS is
  the right size for this store today. Part 7 explains what changes when it is
  not, so that decision is informed rather than urgent.
