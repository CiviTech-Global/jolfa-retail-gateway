# Part 2 — Prepare the Target Server

Almost nothing here is manual. This part explains **what `provision.yml` will
do to the server**, so you can review it before it happens rather than after.

The customer's box is **AlmaLinux 9.8**. The tables below name the RedHat-family
behaviour first, with the Debian equivalent in brackets where they differ.

---

## 2.1 The only manual prerequisites

1. A fresh AlmaLinux/Rocky/RHEL 9 install (or Debian 12 / Ubuntu 22.04–24.04).
2. Your SSH public key in `/root/.ssh/authorized_keys` — `bootstrap.yml` puts it
   there for you if you are still on a password (Part 1.4).
3. DNS pointing at the IP, if you want TLS in the same session (Part 0.3).

That is the list. Do not pre-install Node, PostgreSQL or Nginx — the playbooks
install specific versions from specific repositories, and a hand-installed one
will not match.

---

## 2.2 What `provision.yml` changes

### From `roles/common`

| Change | Why |
|---|---|
| Refuses to run unless `ansible_os_family` is RedHat or Debian | Better to stop at task three than to get halfway and leave a half-configured machine |
| EPEL enabled *(RedHat)* | `fail2ban`, `rclone` and certbot's nginx plugin are not in AppStream |
| Base packages: curl, git, tar, rsync, logrotate, cronie *(cron)*, acl, python3-psycopg2, policycoreutils-python-utils, python3-libselinux, dnf-automatic *(unattended-upgrades)*, firewalld *(ufw)*, fail2ban | `acl` lets Ansible become the `jolfa` user over SSH; `python3-psycopg2` is what the PostgreSQL modules import on the target; `cronie` is absent from a minimal EL9 image and the backup job needs it; the SELinux packages provide `semanage` and `restorecon` |
| Timezone set to `Asia/Tehran` | Log timestamps and the backup cron hour should mean what the customer thinks they mean |
| Group and user `jolfa` created | The API runs as an unprivileged service account. A remote-code bug in an image upload handler then owns an account with no sudo, not the machine |
| `dnf-automatic` set to `apply_updates = yes`, `upgrade_type = security`, timer enabled *(APT periodic)* | Nobody is going to log in weekly. Security errata only — a full auto-upgrade can pull a major version of something at 03:00 |
| SSH drop-in at `/etc/ssh/sshd_config.d/10-jolfa.conf`: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, `MaxAuthTries 3`, validated with `sshd -t` before it is applied | Removes the entire class of brute-force attacks against port 22. Both families include that directory from the stock `sshd_config`, so a drop-in is the least invasive way in |
| firewalld: 22/80/443 allowed, `cockpit` and `dhcpv6-client` removed from the default zone *(ufw: default deny inbound)* | PostgreSQL on 5432 and Node on 3001 become unreachable from outside, which is the point. Cockpit is a login form on 9090 that nothing here uses |
| `/var/log/jolfa` created, logrotate policy installed | PM2 writes there. Without rotation a chatty request log fills the disk, and a full disk takes PostgreSQL down with it |
| `crond` *(cron)* started and enabled | The backup job is a cron entry; a stopped daemon means silent nightly no-ops |

### From `roles/postgresql`

| Change | Why |
|---|---|
| PGDG repository added; the AppStream `postgresql` module disabled *(RedHat)* | EL9's module stream is PostgreSQL 13 and would otherwise shadow the PGDG packages, silently installing the wrong major version |
| `postgresql16-server`, `postgresql16`, `postgresql16-contrib` installed *(`postgresql-16`)* | The version the schema is tested against |
| Explicit `postgresql-16-setup initdb` *(automatic on Debian)* | The PGDG RPMs deliberately do not create a cluster. Without this the service refuses to start |
| `pg_hba.conf`: `127.0.0.1/32` and `::1/128` set to `scram-sha-256` | EL9 ships `ident` for host connections, which rejects the app's password login with a misleading "Ident authentication failed" |
| Role `jolfa_app` created, `NOSUPERUSER NOCREATEROLE NOCREATEDB` | Least privilege. The application never needs to create a database |
| Database `jolfa` created, owned by that role, UTF-8 | Persian content throughout |
| `pgcrypto` enabled | Every primary key defaults to `gen_random_uuid()` |
| `REVOKE CREATE ON SCHEMA public FROM PUBLIC` | Default PostgreSQL lets any role create objects in `public`. This database has exactly one application role |
| `listen_addresses = 'localhost'` | Belt and braces with the firewall. One bad rule edit should not publish a database |
| `/etc/profile.d/pgsql.sh` adds `/usr/pgsql-16/bin` to PATH *(RedHat)* | `pg_dump` and `psql` are not on the default PATH on EL. `scripts/backup.sh` calls them by name |

### From `roles/nodejs`

| Change | Why |
|---|---|
| NodeSource RPM repo via the setup script; AppStream `nodejs` module disabled *(deb repo + keyring)* | EL9's module stream is Node 18 while the app requires 22 |
| Node installed, then the major version asserted | A silent mismatch surfaces much later as a confusing ESM or native-module failure |
| PM2 installed globally, `pm2 startup systemd` configured | The API comes back after a reboot without anyone logging in |

---

## 2.3 Run it

```bash
cd ~/jolfa-retail-gateway/ansible

# Preview. See the note below before reading too much into it.
ansible-playbook -i inventory.ini provision.yml --check --diff

# Then for real.
ansible-playbook -i inventory.ini provision.yml
```

Expect eight to fifteen minutes on a first run — PGDG and NodeSource are the
slow parts — and about thirty seconds on every run after that, with everything
reporting `ok` instead of `changed`.

> **`--check` on a bare server will report failures that are not real.** A dry
> run does not actually install EPEL, so the next task cannot find `fail2ban`
> and reports `No package fail2ban available`. That is the dry run being honest
> about a chicken-and-egg it cannot resolve, not a broken playbook. On *later*
> runs, when the repositories exist, a clean `--check` is meaningful.

---

## 2.4 Verify

```bash
ssh root@198.51.100.10 <<'CHECK'
  id jolfa
  node --version
  pm2 --version
  systemctl is-active postgresql-16 firewalld crond
  sudo -u postgres /usr/pgsql-16/bin/psql -lqt | cut -d '|' -f1 | grep -w jolfa
  firewall-cmd --list-all | head -12
  getenforce
CHECK
```

You want: the `jolfa` user exists, Node is v22.x, PM2 answers, all three
services are `active`, the `jolfa` database is listed, the firewall shows only
22/80/443, and SELinux reports `Enforcing`. Nginx is not installed yet — that is
Part 5.

---

## 2.5 The lock-yourself-out checklist

`roles/common` disables SSH password authentication. If you are still connecting
with a password, run `bootstrap.yml` first — it installs your key and then
proves key-only authentication works before you go anywhere near the hardening:

```bash
ansible-playbook -i inventory.ini bootstrap.yml
# then swap ansible_ssh_pass for ansible_ssh_private_key_file in inventory.ini
```

Before you run the provision, confirm in a **second terminal that stays open**:

```bash
ssh -i ~/.ssh/jolfa_ed25519 root@198.51.100.10 "echo key auth works"
```

Keep that session open until the provision finishes and you have opened a fresh
one successfully. If something goes wrong, the still-open session is your way
back in.

If you do lock yourself out: every VPS provider offers a web console (VNC or
serial) that bypasses SSH entirely. Use it to remove
`/etc/ssh/sshd_config.d/10-jolfa.conf` and `systemctl restart sshd`.

To provision without the SSH hardening — for example on a machine you share with
someone who still uses a password:

```bash
ansible-playbook -i inventory.ini provision.yml -e ssh_hardening_enabled=false
```

---

## 2.6 If a credential changes mid-session

`ansible.cfg` sets `ControlPersist=15m`, so Ansible reuses one SSH master
connection for fifteen minutes. Change the root password or swap to key auth and
the stale socket keeps replaying the old session — which produces confidently
wrong errors like `Your password has expired` long after an interactive `ssh`
works fine.

```bash
rm -rf ~/.ansible/cp/*
```

Do that whenever anything about authentication changes.
