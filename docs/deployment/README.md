# Deploying Jolfa Retail Gateway with Ansible and Semaphore UI

> **The situation this guide assumes.** You work on Windows. The customer has
> bought a Linux VPS and given you its IP address and root SSH access. There is
> a domain that will point at it. You want the deployment to be repeatable — the
> same command produces the same server — and you want the customer's operator
> to be able to redeploy or restore from a browser without touching a terminal.

This guide is modelled on the deployment approach used for VerifyWise
(`C:\Workspace\verifywise\ansible` and the walkthrough in
`C:\Workspace\VerifyWise Analysis`), adapted to what Jolfa actually is: a
native Node + PostgreSQL + Nginx install rather than a Docker Compose stack.

Everything described here is implemented in [`ansible/`](../../ansible/) at the
repository root. Nothing in this guide is aspirational — every command refers to
a playbook that exists.

---

## How to read this

| Part | Topic | Read it when |
|---|---|---|
| [0 — Before you start](./00-before-you-start/00-what-you-will-learn.md) | What Jolfa is made of; what Ansible and Semaphore do | You are new to Ansible |
| [1 — Prepare your control machine](./01-prepare-control-machine/00-overview.md) | WSL, Ansible, SSH keys | You have not installed Ansible yet |
| [2 — Prepare the target server](./02-prepare-target-server/00-overview.md) | What the VPS needs; DNS | Before the first run |
| [3 — Configure Ansible](./03-configure-ansible/00-overview.md) | Inventory, group_vars, the vault | You are ready to describe the customer's server |
| [4 — Deploy](./04-deploy-jolfa/00-overview.md) | `provision.yml` then `deploy.yml` | First deployment |
| [5 — Nginx and SSL](./05-nginx-and-ssl/00-overview.md) | Reverse proxy, caching, HTTPS | You want the domain live |
| [6 — Semaphore UI](./06-semaphore-ui/00-overview.md) | A browser front end for these playbooks | After the CLI deploy works |
| [7 — Day 2 operations](./07-day-2-operations/00-overview.md) | Updates, rollback, backups, logs | Forever after |
| [8 — Reference](./08-reference/useful-commands.md) | Commands, variables, glossary, go-live checklist | Whenever |

**Recommended path:** Parts 0–5 get the site live on HTTPS. Part 6 adds the web
UI. Part 7 is what you hand to whoever operates it.

---

## What you end up with

- An Ubuntu server running the Jolfa API under PM2 (2 cluster workers), Nginx
  serving the React bundle and terminating TLS, and PostgreSQL on loopback.
- Releases in timestamped directories with a `current` symlink, so a rollback
  is a symlink flip rather than a re-clone.
- A nightly database + uploads backup with an off-box copy, and a restore
  script you have rehearsed.
- Semaphore UI on the server (loopback only), from which the customer's
  operator can run Deploy, Rollback and Backup as buttons.

---

## What is deliberately left as a placeholder

Two things are configured but not switched on, because they need decisions and
purchases the customer has not made yet. Both are single-variable changes:

| Placeholder | Where | To go live |
|---|---|---|
| **Payment gateway** — ZarinPal stays in sandbox, no real money moves | `zarinpal_sandbox: "true"` in `ansible/group_vars/all/main.yml` | Set it to `"false"` and put the real merchant ID in the vault. See [going-live.md](./08-reference/going-live.md) |
| **SMS provider** — password-reset codes are written to the server log instead of sent | `kavenegar_api_key` / `sms_ir_api_key`, both empty | Fill exactly one, in the vault |

Server-specific values (IP, domain, email, repository URL, passwords) are also
placeholders — every one of them reads `REPLACE_ME_*` and the playbooks assert
on them rather than deploying something half-configured.

---

## Where things live

```text
jolfa-retail-gateway/
├── ansible/
│   ├── ansible.cfg
│   ├── inventory.example.ini        # copy to inventory.ini (gitignored)
│   ├── group_vars/all/
│   │   ├── main.yml                 # all non-secret configuration
│   │   └── vault.example.yml        # copy to vault.yml, fill, encrypt
│   ├── ping.yml                     # connectivity smoke test
│   ├── provision.yml                # packages, firewall, user, Postgres, Node
│   ├── deploy.yml                   # build + release + PM2 reload
│   ├── nginx.yml                    # reverse proxy + TLS
│   ├── rollback.yml                 # flip `current` back
│   ├── backup.yml                   # install the nightly job / run one now
│   ├── semaphore.yml                # install Semaphore UI
│   ├── site.yml                     # provision + deploy + nginx
│   └── roles/{common,postgresql,nodejs,app,nginx,backup,semaphore}/
├── scripts/backup.sh, restore.sh    # called by the backup role and by cron
└── docs/deployment/                 # this guide
```
