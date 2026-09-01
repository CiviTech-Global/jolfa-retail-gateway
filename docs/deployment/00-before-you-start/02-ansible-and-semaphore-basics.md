# 0.2 — Ansible and Semaphore UI Basics

The minimum you need to read the playbooks in `ansible/` and know what they
will do before you run them.

---

## 0.2.1 What Ansible is

A tool that describes server configuration in text files and applies it over
SSH. It is **agentless**: nothing is installed on the target server to support
it. You install Ansible on your laptop; it connects as an SSH user, uploads
small Python programs, runs them, collects the results, and removes them.

The property that makes it worth learning is **idempotence**: a well-written
task describes a desired state ("nginx is installed", "this file contains
this"), not an action. Running the same playbook twice leaves the server in the
same place, and the second run reports `ok` instead of `changed`. That is what
lets you re-run `provision.yml` any time you change a variable, without
wondering what it will break.

---

## 0.2.2 The five terms you need

### Inventory

The list of servers. Jolfa's ([`inventory.example.ini`](../../../ansible/inventory.example.ini)):

```ini
[jolfa]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root

[jolfa:vars]
domain_name=shop.example.ir
certbot_email=ops@example.ir
```

- `[jolfa]` is a group name. The playbooks say `hosts: jolfa`.
- `jolfa-prod` is a label for the server, not a hostname.
- `ansible_host` is the IP Ansible connects to; `ansible_user` is the SSH user.
- `[jolfa:vars]` sets variables for every host in the group.

Your real `inventory.ini` is gitignored — the customer's IP does not belong in
source control.

### Playbook

A YAML file mapping hosts to work. From [`provision.yml`](../../../ansible/provision.yml):

```yaml
- name: Provision the Jolfa server
  hosts: jolfa
  become: true
  roles:
    - common
    - postgresql
    - nodejs
```

`become: true` means "run as root via sudo".

### Role

A reusable bundle of tasks, templates and handlers. Jolfa has seven:

| Role | Responsible for |
|---|---|
| `common` | Packages, firewall, SSH hardening, the `jolfa` user, log rotation |
| `postgresql` | PostgreSQL 16, the database, the role, loopback binding |
| `nodejs` | Node 22 from NodeSource, PM2, PM2 boot startup |
| `app` | Env files, git checkout, build, migrate, symlink flip, health check |
| `nginx` | Vhost, caching, edge rate limits, certbot |
| `backup` | Nightly cron job, rclone, the backup directory |
| `semaphore` | Docker and Semaphore UI |

Splitting them this way means `deploy.yml` can run `app` twenty times a week
without ever re-running the firewall or database setup.

### Variables

Values that change between environments. In Jolfa they live in exactly three
places, and knowing which is which saves a lot of confusion:

| Where | What goes there | Example |
|---|---|---|
| `inventory.ini` | Per-server facts | `domain_name`, `ansible_host` |
| `group_vars/all/main.yml` | Non-secret configuration | `pm2_instances`, `backup_retention_days`, `zarinpal_sandbox` |
| `group_vars/all/vault.yml` | Secrets, **encrypted** | `vault_jwt_secret`, `vault_db_password` |

Anything you can put in a screenshot goes in `main.yml`. Anything that would be
a security incident goes in the vault.

### Template

A file with placeholders, rendered per-server before being copied. Jolfa's:

- `roles/app/templates/server.env.j2` → `/var/www/jolfa/shared/Jolfa-Server/.env`
- `roles/app/templates/web.env.production.j2` → the frontend's build-time env
- `roles/app/templates/ecosystem.config.cjs.j2` → the PM2 config
- `roles/nginx/templates/jolfa.conf.j2` → `/etc/nginx/conf.d/jolfa.conf` on EL9 (`sites-available/jolfa` on Debian)
- `roles/nginx/templates/nginx.conf.j2` → `/etc/nginx/nginx.conf`, EL9 only

This is where the deployment gets its consistency: `CORS_ORIGIN`, the payment
callback URL and the frontend's baked-in API base are all derived from one
`domain_name`, so they cannot drift apart.

---

## 0.2.3 Ansible Vault in one minute

Vault encrypts a YAML file with a password. The encrypted file is safe to
commit; the password is not.

```bash
cd ansible
cp group_vars/all/vault.example.yml group_vars/all/vault.yml
nano group_vars/all/vault.yml          # fill in real values
ansible-vault encrypt group_vars/all/vault.yml
```

From then on:

```bash
ansible-vault edit group_vars/all/vault.yml       # decrypt, edit, re-encrypt
ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass
```

Generate real secrets, never invent them by hand:

```bash
openssl rand -hex 32       # JWT secret
openssl rand -base64 24    # database password
```

`deploy.yml` refuses to run if the vault still contains `REPLACE_ME` values or
a JWT secret shorter than 32 characters. A shipped placeholder secret means
anyone who can read this repository can mint an admin token.

---

## 0.2.4 What Semaphore UI is

A web dashboard that runs `ansible-playbook` for you and keeps the output. It
does not replace Ansible; it wraps it.

It stores SSH keys, vault passwords, inventories, and **templates** — a saved
combination of (repository, playbook, inventory, variables) that becomes a
button.

**Why bother, when the CLI works?**

- The customer's operator can redeploy or restore without WSL, Ansible, or an
  SSH key on their laptop.
- Every run is logged: who ran what, when, and the full output. When something
  broke at 2am, this is the record.
- Scheduled runs — a nightly backup verification, for instance — without
  hand-editing crontabs.

**Why it is not the whole story:** Semaphore holds the SSH key to the server and
the vault password. It is therefore the most valuable target on the machine,
which is why `semaphore.yml` binds it to `127.0.0.1` and does not open a
firewall port. You reach it through an SSH tunnel. Part 6 covers that.

---

## 0.2.5 Reading a run

```bash
ansible-playbook -i inventory.ini provision.yml --ask-vault-pass
```

Each task prints one of:

| Result | Meaning |
|---|---|
| `ok` | Already in the desired state. Nothing was done. |
| `changed` | The server was modified. |
| `skipping` | A `when:` condition was false. |
| `failed` | Stop and read the message. The play halts for that host. |

Two flags worth knowing before you touch a live server:

```bash
--check --diff    # dry run: report what would change, change nothing
--limit jolfa-prod  # act on one host only
--tags nginx      # run a subset (where tags are defined)
```

`--check` is not perfect — a task that depends on the result of an earlier task
that did not really run can report oddly — but on `nginx.yml` and `provision.yml`
it is an honest preview.
