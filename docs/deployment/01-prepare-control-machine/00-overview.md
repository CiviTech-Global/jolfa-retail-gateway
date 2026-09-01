# Part 1 — Prepare Your Control Machine

Goal: a Windows laptop that can run `ansible-playbook` against the customer's
server. Takes about twenty minutes, once.

---

## 1.1 Install WSL and Ubuntu

Ansible does not run natively on Windows. WSL gives you a real Ubuntu.

Open **PowerShell as Administrator**:

```powershell
wsl --install -d Ubuntu-24.04
```

Reboot if prompted. On first launch Ubuntu asks for a username and password —
this is a local Linux account, unrelated to the server.

Check what you have:

```powershell
wsl --list --verbose
```

You want `Ubuntu-24.04` with `STATE: Running` and `VERSION: 2`.

From here on, **every command runs inside WSL**, not PowerShell. Open it with:

```powershell
wsl -d Ubuntu-24.04
```

---

## 1.2 Install Ansible

```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt install -y ansible git

ansible --version
```

You want `ansible [core 2.16]` or newer.

> The distribution's `ansible` package is often a version or two behind. The PPA
> matters here because `roles/postgresql` uses `community.postgresql`, which
> expects a reasonably current core.

---

## 1.3 Install the collections the playbooks use

```bash
cd ~/jolfa-retail-gateway/ansible      # see 1.5 for where this comes from
ansible-galaxy collection install -r requirements.yml
```

This installs `community.general` (ufw, timezone, npm), `community.postgresql`
(database and role management) and `ansible.posix` (task profiling).

---

## 1.4 Create an SSH key and put it on the server

Password authentication over SSH is fine for the first five minutes and a
liability after that — `roles/common` disables it. Set up a key first, or you
will lock yourself out.

```bash
ssh-keygen -t ed25519 -C "jolfa-deploy" -f ~/.ssh/jolfa_ed25519
ssh-copy-id -i ~/.ssh/jolfa_ed25519.pub root@198.51.100.10
```

### If the customer gave you a password rather than a key

Ansible can authenticate with a password, but it needs `sshpass` and the
password has to live in the inventory:

```bash
sudo apt install -y sshpass
```

```ini
[jolfa]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root ansible_ssh_pass="the-password"
```

Then let Ansible install the key for you and prove it works:

```bash
ansible-playbook -i inventory.ini bootstrap.yml
```

`bootstrap.yml` authorises your public key for root and then makes a second
connection using **only** the key, with `PasswordAuthentication=no`. If that
second connection fails, the playbook fails — which is the point. Do not run
`provision.yml` until it passes.

Afterwards, delete the `ansible_ssh_pass` line and switch to
`ansible_ssh_private_key_file`. A password sitting in an inventory file is a
password one careless `git add -f` away from being public.

Prove it works **without a password** before continuing:

```bash
ssh -i ~/.ssh/jolfa_ed25519 root@198.51.100.10 "hostname"
```

Then tell Ansible to use it, in `inventory.ini`:

```ini
[jolfa]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root ansible_ssh_private_key_file=~/.ssh/jolfa_ed25519
```

> **Do not skip the proof.** `roles/common` sets `PasswordAuthentication no`. If
> your key is not working when that task runs, your next connection attempt is
> your last one, and recovery means the VPS provider's console.

---

## 1.5 Get the repository into WSL

**Clone it inside the Linux filesystem, not under `/mnt/c`.**

```bash
cd ~
git clone <the customer repository URL> jolfa-retail-gateway
cd jolfa-retail-gateway/ansible
```

Two reasons this matters, both of which cost an hour if you learn them the hard
way:

1. **Ansible ignores `ansible.cfg` in a world-writable directory.** Everything
   under `/mnt/c` is world-writable from Linux's point of view, so Ansible
   silently drops your configuration and you lose `roles_path`, SSH pipelining
   and the inventory default. You get a warning, buried in the output.
2. **SSH keys under `/mnt/c` have unfixable permissions.** OpenSSH refuses a
   private key that is group-readable, and DrvFs cannot express `0600`.

If you must work from `/mnt/c` — for instance because you are editing the repo
in Windows — at least set the config path explicitly:

```bash
export ANSIBLE_CONFIG=/mnt/c/Workspace/RTJG-clients/jolfa-retail-gateway/ansible/ansible.cfg
```

---

## 1.6 Verify the whole chain

```bash
cd ~/jolfa-retail-gateway/ansible
cp inventory.example.ini inventory.ini
# edit inventory.ini: real IP, domain, email

ansible-playbook -i inventory.ini ping.yml
```

Expected output ends with something like:

```text
ok: [jolfa-prod] => {
    "msg": "jolfa-prod (198.51.100.10) — Ubuntu 24.04, 2 vCPU, 3.8 GB RAM, 34 GB free on /"
}
```

If it does, your control machine is ready. Move to Part 2.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Permission denied (publickey)` | Key not on the server, or wrong path | Re-run `ssh-copy-id`; check `ansible_ssh_private_key_file` |
| `Host key verification failed` | First connection to this IP | `ssh root@IP` once and accept, or set `host_key_checking = False` temporarily |
| `Ansible is being run in a world writable directory` | Repo is under `/mnt/c` | Move it to `~`, or export `ANSIBLE_CONFIG` (1.5) |
| `couldn't resolve module ansible.posix.profile_tasks` | Collections not installed | `ansible-galaxy collection install -r requirements.yml` |
| `UNREACHABLE ... timed out` | Firewall or wrong IP | `ping` the IP; check the provider's own firewall rules |
