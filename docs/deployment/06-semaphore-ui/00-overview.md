# Part 6 — Semaphore UI

At this point the store is live and every operation is a command in WSL. That
works while you are the only operator. Semaphore turns those same playbooks into
buttons in a browser, with a log of who pressed what and when.

---

## What Semaphore is, precisely

A web application that runs `ansible-playbook` on your behalf. It stores:

- **Repositories** — where the playbooks come from (this git repo).
- **Inventories** — the same INI content as `inventory.ini`.
- **Key store** — SSH private keys, vault passwords, login credentials.
- **Environments** — extra variables passed with `-e`.
- **Templates** — a saved (repository + playbook + inventory + environment)
  combination. This is the button.
- **Task history** — every run, its full output, who started it, how long it
  took.

It is not a replacement for understanding Ansible. It is a way for someone who
does not have WSL, Ansible, an SSH key and a vault password on their laptop to
still deploy safely.

---

## Read in this order

| Page | What it covers |
|---|---|
| [01 — Install Semaphore](./01-install-semaphore.md) | `semaphore.yml`, and why it binds to loopback |
| [02 — First login](./02-first-login.md) | Reaching it over an SSH tunnel |
| [03 — Create the project](./03-create-jolfa-project.md) | The Jolfa project and its repository |
| [04 — Inventory and keys](./04-add-inventory-and-keys.md) | SSH key, vault password, inventory |
| [05 — Create the templates](./05-create-templates.md) | Deploy, Rollback, Backup, Nginx as buttons |
| [06 — Run the first job](./06-run-first-job.md) | Pressing Deploy and reading the output |
| [07 — Schedule the backup check](./07-schedule-backups.md) | Recurring runs |

---

## Before you start

Semaphore should be the **last** thing you set up, not the first. Get a
successful CLI deploy first (Parts 4 and 5). Debugging Ansible through a web UI
that is itself misconfigured is a bad first experience of both tools.

---

## The security position, stated plainly

Semaphore holds the SSH key to the production server and the password that
decrypts the vault. Anyone who can log into Semaphore can deploy arbitrary code
to the store and read every secret it has.

Consequences, all of which the playbook enforces or documents:

1. **It binds to `127.0.0.1` only.** No firewall port is opened. You reach it
   through an SSH tunnel (Part 6.2).
2. **Its admin password comes from the vault**, not from a default.
3. **If you ever expose it publicly**, it needs its own nginx vhost with TLS,
   IP allow-listing, and ideally basic auth in front — and at that point you
   have added a second internet-facing service to maintain, so be sure the
   convenience is worth it.
4. **BoltDB, single file.** Fine for one project and one or two operators. It
   lives in a Docker volume; back it up if the run history matters to you.
