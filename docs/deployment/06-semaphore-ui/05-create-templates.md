# 6.5 — Create the Task Templates

A template is a saved run configuration. Five of them cover everything the
customer's operator needs.

Every template shares:

| Field | Value |
|---|---|
| Repository | `jolfa-retail-gateway` |
| Inventory | `jolfa-prod` |
| Environment | `jolfa-defaults` |
| Vault Password | `jolfa-vault-password` |

The playbook path is relative to the repository root, so it always starts with
`ansible/`.

---

## 1. Deploy

| Field | Value |
|---|---|
| Name | `Deploy` |
| Playbook Filename | `ansible/deploy.yml` |
| Description | Builds a new release from `main` and switches to it. Takes a backup first. |

This is the button that gets pressed weekly. Leave "Allow override branch on
launch" **on**, so a hotfix tag can be deployed without editing the template.

## 2. Nginx + SSL

| Field | Value |
|---|---|
| Name | `Nginx + SSL` |
| Playbook Filename | `ansible/nginx.yml` |
| Description | Rewrites the vhost and renews the certificate. Safe to re-run. |

## 3. Backup now

| Field | Value |
|---|---|
| Name | `Backup now` |
| Playbook Filename | `ansible/backup.yml` |
| Extra CLI Arguments | `["-e", "run_now=true"]` |
| Description | Takes an immediate database + uploads backup and pushes it off-box. |

Run this before anything risky, and before any manual data edit.

## 4. Rollback

| Field | Value |
|---|---|
| Name | `Rollback` |
| Playbook Filename | `ansible/rollback.yml` |
| Description | **Reverts CODE ONLY.** If the bad release changed the database schema, restore the database too. |
| Survey Variable | `target_release` — optional, e.g. `20260901-104500` |

Put that warning in the description field, not just here. The person pressing
this button at 2am is not going to open the documentation first.

Add a **Survey Variable** named `target_release`, optional, so an operator can
pick a specific release from the launch dialog instead of defaulting to the
previous one.

## 5. Provision

| Field | Value |
|---|---|
| Name | `Provision (rarely needed)` |
| Playbook Filename | `ansible/provision.yml` |
| Description | Base packages, firewall, PostgreSQL, Node. Only after changing base configuration. |

---

## What to deliberately NOT put in Semaphore

**`restore.sh`.** Restoring drops every object in the target database. It should
require an SSH session, a human reading a manifest, and a typed confirmation —
not a button next to "Deploy" that someone clicks by accident. Part 7.3 covers
restore as a deliberate, manual procedure.

---

## Notifications

Semaphore can post to Telegram or Slack on failure. For an Iranian customer
Telegram is usually the practical choice.

**Project Settings → Telegram** — set a bot token and chat ID, then enable
alerts per template. The one that matters is `Deploy`: a failed deploy that
nobody notices is a site that stayed on the old release for a week while
everyone assumed the fix had shipped.

---

## Permissions

If the customer's operator gets a login, give them access to `Deploy`,
`Backup now` and `Rollback`, and keep `Provision` for you. Semaphore's
project-level roles are coarse, so in practice this means agreeing a convention
and relying on the run history — which is precisely why every run being logged
matters.

Next: [06 — Run the first job](./06-run-first-job.md).
