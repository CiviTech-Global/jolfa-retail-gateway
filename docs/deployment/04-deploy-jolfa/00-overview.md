# Part 4 — Deploy the Application

`deploy.yml` builds a new release and switches to it. This part walks through
exactly what it does, in order, and what to check at each stage.

---

## 4.1 Run it

```bash
cd ~/jolfa-retail-gateway/ansible
ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass
```

First run: eight to fifteen minutes, most of it `npm ci` and the Vite build.
Later runs: three to six.

---

## 4.2 What happens, step by step

### Pre-flight assertions

Before touching anything the play refuses to continue if:

- `git_repo` is still `REPLACE_ME_GIT_URL`
- `vault_jwt_secret` is a placeholder or shorter than 32 characters
- `vault_db_password` is a placeholder

These are assertions rather than warnings on purpose. A store deployed with the
example JWT secret is a store where anyone who has read this repository can mint
an admin token.

### A backup, before anything else

If a release is already live, `scripts/backup.sh` runs first — database dump
plus uploads archive plus a manifest, with an off-box copy if `backup_remote` is
set.

**Why here and not after:** Prisma migrations are forward-only. There is no
`migrate down`. If this deploy's migration drops a column, `rollback.yml` can put
the old code back but nothing can put the data back except this dump.

Skip it (a hotfix with no migration, when you are in a hurry):

```bash
ansible-playbook -i inventory.ini deploy.yml -e pre_deploy_backup=false
```

### Environment files, rendered before the build

`shared/Jolfa-Server/.env` (mode `0600`, owned by `jolfa`) and
`shared/Jolfa-web/.env.production`.

Both are rendered from templates, so `CORS_ORIGIN`, `APP_URL`, the payment
callback URL and the frontend's `VITE_API_BASE_URL` all derive from the single
`domain_name` you set in Part 3.

### Checkout

A shallow clone of `git_branch` into `releases/<timestamp>/`, as the `jolfa`
user. The resolved commit SHA is written to `REVISION` in the release directory,
so `cat /var/www/jolfa/current/REVISION` always answers "what is actually
running".

### Shared symlinks

```text
release/Jolfa-Server/.env            -> shared/Jolfa-Server/.env
release/Jolfa-web/.env.production    -> shared/Jolfa-web/.env.production
release/Jolfa-Server/uploads         -> shared/uploads
```

The uploads link is why product images survive a deploy.

### Build

```text
Jolfa-Server:  npm ci  →  prisma generate  →  npm run build
Jolfa-web:     npm ci  →  npm run build
```

`npm ci`, never `npm install`: the lockfile is the contract, and a deploy that
quietly resolves a different dependency tree than CI tested is a deploy that has
not been tested.

`prisma generate` before `tsc`, because the compiler typechecks against the
generated client — a schema change against a stale client fails the build in a
way that looks like a type error in unrelated code.

### The bundle check

```yaml
- name: Verify the frontend was built against the right API URL
  ansible.builtin.shell:
    cmd: grep -rlF "{{ frontend_api_base_url }}" .../dist/assets/
```

This exists because the failure it catches is silent. A frontend built without
`VITE_API_BASE_URL` compiles cleanly, deploys cleanly, and then every visitor's
browser tries to reach `localhost:3001`. The grep proves the intended URL is
actually inside the shipped JavaScript.

### Migrate

`npx prisma migrate deploy` — applies committed migrations, never generates or
resets. Runs after the build so a TypeScript error aborts while the database is
still untouched.

### Switch and reload

`current` moves to the new release, then:

```bash
pm2 reload shared/ecosystem.config.cjs --update-env
```

`reload` is a rolling restart across the cluster workers. The API drains
in-flight requests on `SIGTERM` before exiting, so a checkout in progress
finishes rather than erroring.

### Health check

Twenty attempts, three seconds apart, against
`http://127.0.0.1:3001/health`.

**If this fails, the new release is live and unhealthy.** The play stops there
so you notice. Recovery is Part 7.4 (`rollback.yml`).

### Prune

Everything older than the newest `releases_to_keep` (5) is deleted. Five copies
of `node_modules` is about 2 GB.

---

## 4.3 Verify

```bash
# The API is up and answering
ssh root@198.51.100.10 "curl -s localhost:3001/health"
# {"success":true,"data":{"status":"ok","timestamp":"..."}}

# PM2 has two online workers
ssh root@198.51.100.10 "sudo -u jolfa pm2 list"

# What commit is live
ssh root@198.51.100.10 "cat /var/www/jolfa/current/REVISION"

# The bundle was built
ssh root@198.51.100.10 "ls /var/www/jolfa/current/Jolfa-web/dist/assets | head"
```

The site is not reachable from a browser yet — nothing is listening on port 80.
That is Part 5.

---

## 4.4 Deploying a specific version

```bash
# A tag or branch
ansible-playbook -i inventory.ini deploy.yml -e git_branch=v1.2.0

# Preview without changing anything
ansible-playbook -i inventory.ini deploy.yml --check --diff
```

---

## 4.5 When it fails

| Failure | Likely cause | Fix |
|---|---|---|
| `Killed` during `npm ci` or the Vite build | Out of memory | Add swap (below), or build off-server |
| `npm ci` hangs or times out | Registry unreachable from the VPS | Configure a mirror in `/home/jolfa/.npmrc` |
| `Permission denied (publickey)` at checkout | Private repo, no deploy key | Part 3.2 |
| `P1001: Can't reach database server` | PostgreSQL down, or wrong password in the vault | `systemctl status postgresql`; re-check `vault_db_password` |
| Bundle check fails | `.env.production` not rendered, or the build ignored it | `cat /var/www/jolfa/shared/Jolfa-web/.env.production` |
| Health check fails | The app crashed on boot | `sudo -u jolfa pm2 logs jolfa-api --lines 100` — usually a bad env value the Zod schema rejected |

Add swap on a small box:

```bash
ssh root@198.51.100.10 <<'SWAP'
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  free -h
SWAP
```
