# 0.3 — The Server and the Domain

What to check before you run anything, and what to ask the customer for.

---

## What you need from the customer

| Item | Why | Placeholder in this repo |
|---|---|---|
| VPS public IP | Ansible connects to it; DNS points at it | `REPLACE_ME_SERVER_IP` in `inventory.ini` |
| Root SSH access (password or key) | Provisioning installs packages | `ansible_user=root` |
| Domain name | Nginx `server_name`, TLS certificate, CORS, payment callbacks | `REPLACE_ME_DOMAIN` |
| An email address | Let's Encrypt expiry warnings | `REPLACE_ME_EMAIL` |
| Git repository URL | The server clones the code | `REPLACE_ME_GIT_URL` in `group_vars/all/main.yml` |

Nothing else. Payment credentials and SMS keys are explicitly *not* needed yet —
the deployment runs in sandbox without them.

---

## Server sizing

The deploy **builds on the server**: `npm ci` plus a Vite production build for
the frontend and `tsc` for the backend. That peaks around 1.5 GB of RAM.

| Spec | Verdict |
|---|---|
| 1 vCPU / 1 GB | The build is OOM-killed partway through and reports a confusing npm crash. Add 2 GB of swap, or build elsewhere. |
| 2 vCPU / 2 GB | Workable. This is the minimum the playbooks assume. |
| 2 vCPU / 4 GB | Comfortable. Recommended — **and what the customer has**: 2 vCPU, 3.6 GB, 55 GB free. |
| 4 vCPU / 8 GB | More than this store needs until it is doing serious traffic. |

Disk: 40 GB is plenty. The `releases_to_keep: 5` setting exists partly because
five copies of `node_modules` is roughly 2 GB.

`ping.yml` reports the server's actual RAM and warns if it is under 1.9 GB. On
this box it reports:

```text
jolfa-prod (198.51.100.10) — AlmaLinux 9.8, 2 vCPU, 3.6 GB RAM, 54 GB free on /
```

**Operating system:** the customer's server runs **AlmaLinux 9.8**, and that is
the platform the playbooks are written and tested against. Rocky Linux 9 and
RHEL 9 are the same thing for these purposes.

Debian and Ubuntu are also supported — every role loads
`vars/{{ ansible_os_family }}.yml` and branches where the two genuinely differ
(`dnf`/`apt`, `firewalld`/`ufw`, PGDG/distro PostgreSQL, `conf.d`/`sites-enabled`) —
but RedHat is the tested path. `roles/common` refuses to run on anything else
rather than getting halfway and leaving a half-configured machine.

Three things about EL9 that shape the playbooks, and will bite you if you go
around them:

- **SELinux is Enforcing.** Nginx cannot `proxy_pass` to Node without the
  `httpd_can_network_connect` boolean, and cannot serve the release directory
  without the right file labels. Both are handled in `roles/nginx`, and each
  new release is relabelled in `roles/app`. Symptoms if you skip it: a 502 with
  nothing useful in the upstream log, or every asset 403ing while `index.html`
  loads fine.
- **PostgreSQL comes from PGDG, not AppStream.** EL9's module stream is
  version 13; the role adds the PGDG repository, disables that module so it
  cannot shadow the newer packages, and runs an explicit `initdb` — the RPMs,
  unlike the Debian packages, do not create a cluster for you.
- **The stock nginx config contains its own default server block.** There is no
  `sites-enabled/default` to delete, so `roles/nginx` replaces
  `/etc/nginx/nginx.conf` with a managed copy that drops it. While the site is
  served from a bare IP, whichever block is `default_server` answers every
  request — leaving the stock one in place serves the nginx welcome page to
  every visitor.

---

## DNS

Point an `A` record at the VPS IP before you run `nginx.yml` with SSL enabled.
Let's Encrypt validates by fetching a file over HTTP from the domain; if the
domain does not resolve to this server yet, certbot fails and leaves the vhost
half-configured.

```text
Type   Name    Value             TTL
A      @       198.51.100.10     300
A      www     198.51.100.10     300      (optional)
```

Check propagation from WSL before proceeding:

```bash
dig +short shop.example.ir
# should print the VPS IP and nothing else
```

If DNS is not ready and you want the site up on the IP meanwhile:

```bash
ansible-playbook -i inventory.ini nginx.yml -e enable_ssl=false
```

Then re-run without the flag once DNS resolves. That is the intended path, not a
workaround.

---

## The Iran-specific notes

This store is aimed at Iranian customers and will likely run on an Iranian VPS.
Three things behave differently there and are worth knowing before they surprise
you at midnight:

1. **npm and NodeSource may be slow or blocked.** If `npm ci` stalls on the
   server, configure a mirror in the app user's `.npmrc`, or build the release
   on your laptop and rsync `dist/` up. The playbooks build on the server
   because that is simpler when the network cooperates.
2. **Let's Encrypt works from Iranian IPs**, but rate-limits per domain: five
   failed validations per hour. Do not loop `nginx.yml` while debugging DNS —
   use `-e enable_ssl=false` until `dig` is clean.
3. **sentry.io is not reliably reachable.** That matters for the error-tracking
   gap discussed in Part 7; the practical answer is a self-hosted
   Sentry-protocol server (GlitchTip) inside the same network, not a foreign
   SaaS.

---

## Before you move on

```bash
# From WSL. Replace with the real IP.
ssh root@198.51.100.10 "cat /etc/os-release | head -2; free -h | head -2; df -h /"
```

If that command prints a supported distribution (AlmaLinux/Rocky/RHEL 9, or
Debian/Ubuntu), some memory and some free disk, you are ready for Part 1.
