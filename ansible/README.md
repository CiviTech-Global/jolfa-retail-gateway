# Ansible automation for Jolfa Retail Gateway

Provisions a Linux VPS, deploys the application, and configures Nginx with TLS.
Optionally installs Semaphore UI so the same playbooks can be run from a
browser.

**Full walkthrough:** [`docs/deployment/`](../docs/deployment/README.md) —
start with [QUICKSTART](../docs/deployment/QUICKSTART.md) if you have done this
before.

---

## Layout

```text
ansible/
├── ansible.cfg                  run playbooks from this directory
├── requirements.yml             collections: community.general/postgresql, ansible.posix
├── inventory.example.ini        copy to inventory.ini (gitignored)
├── group_vars/all/
│   ├── main.yml                 all non-secret configuration
│   └── vault.example.yml        copy to vault.yml, fill, ansible-vault encrypt
├── ping.yml                     connectivity + server facts
├── bootstrap.yml                install your SSH key BEFORE SSH is hardened
├── provision.yml                packages, firewall, SSH, user, PostgreSQL, Node, PM2
├── deploy.yml                   backup → build → migrate → switch → health check
├── nginx.yml                    vhost, caching, edge rate limits, certbot
├── rollback.yml                 flip `current` back to the previous release
├── backup.yml                   install the nightly cron job / run one now
├── semaphore.yml                Semaphore UI in Docker, loopback only
├── site.yml                     provision + deploy + nginx
└── roles/{common,postgresql,nodejs,app,nginx,backup,semaphore}/
```

## Usage

```bash
cd ansible
cp inventory.example.ini inventory.ini            # fill in the REPLACE_ME values
cp group_vars/all/vault.example.yml group_vars/all/vault.yml
ansible-vault encrypt group_vars/all/vault.yml

ansible-playbook -i inventory.ini ping.yml
ansible-playbook -i inventory.ini site.yml --ask-vault-pass
```

**If you are still connecting with a password**, install a key first —
`provision.yml` disables password authentication, and running it before the key
works locks you out:

```bash
sudo apt install -y sshpass
ssh-keygen -t ed25519 -C jolfa-deploy -f ~/.ssh/jolfa_ed25519
ansible-playbook -i inventory.ini bootstrap.yml
# then swap ansible_ssh_pass for ansible_ssh_private_key_file in inventory.ini
```

## Design notes

- **Releases, not in-place updates.** Each deploy builds a whole new directory
  under `releases/` and only then moves the `current` symlink. A failed build
  never touches the running site, and a rollback is a symlink flip.
- **State lives in `shared/`.** Uploads and rendered `.env` files survive every
  deploy. If uploads lived in the release, each deploy would orphan every
  product image.
- **Build, then migrate, then switch.** A TypeScript error must abort while the
  database is still untouched.
- **Secrets are asserted, not assumed.** `deploy.yml` refuses to run with a
  placeholder JWT secret or database password.
- **The app is native, Semaphore is Docker.** Jolfa has no Dockerfile and builds
  with `npm run build`; Semaphore ships only as a container.
- **Payments and SMS are placeholders on purpose** — sandbox and log-only. See
  [going-live.md](../docs/deployment/08-reference/going-live.md).

## Relationship to `scripts/deploy.sh`

`scripts/deploy.sh` is the older single-server bash deploy: `git pull` in place,
build, `pm2 reload`. It still works and is fine for a quick manual push.

The Ansible path supersedes it for anything the customer depends on, because it
also provisions the server, keeps releases for rollback, backs up before
migrating, renders every config from one set of variables, and leaves a record
of who ran what.

`scripts/backup.sh` and `scripts/restore.sh` are *not* superseded — the backup
role installs and calls them.
