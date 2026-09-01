# Quickstart

The whole deployment in fourteen commands, for when you have done it before.
If any step is unfamiliar, read the numbered parts instead.

---

## Prerequisites

- Ubuntu 22.04/24.04 VPS, 2 GB RAM minimum, root SSH key access
- DNS `A` record pointing at it
- WSL with Ansible on your laptop

---

## 1. Control machine

```bash
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt install -y ansible git

ssh-keygen -t ed25519 -C jolfa-deploy -f ~/.ssh/jolfa_ed25519
ssh-copy-id -i ~/.ssh/jolfa_ed25519.pub root@SERVER_IP
ssh -i ~/.ssh/jolfa_ed25519 root@SERVER_IP hostname   # must not prompt
```

## 2. Repository — inside `~`, not `/mnt/c`

```bash
cd ~ && git clone <repo-url> jolfa-retail-gateway
cd jolfa-retail-gateway/ansible
ansible-galaxy collection install -r requirements.yml
```

## 3. Configure

```bash
cp inventory.example.ini inventory.ini
nano inventory.ini      # ansible_host, domain_name, domain_alias, certbot_email

nano group_vars/all/main.yml    # git_repo — the only mandatory edit

cp group_vars/all/vault.example.yml group_vars/all/vault.yml
openssl rand -hex 32            # -> vault_jwt_secret
openssl rand -base64 24         # -> vault_db_password
openssl rand -base64 18         # -> vault_admin_seed_password, vault_semaphore_admin_password
nano group_vars/all/vault.yml
ansible-vault encrypt group_vars/all/vault.yml
```

## 3b. Password auth only? Install a key first

`provision.yml` disables SSH password authentication. Running it before your key
works locks you out.

```bash
sudo apt install -y sshpass
# inventory.ini: ansible_ssh_pass="the-password"
ansible-playbook -i inventory.ini bootstrap.yml
# then swap it for ansible_ssh_private_key_file=~/.ssh/jolfa_ed25519
ssh -i ~/.ssh/jolfa_ed25519 root@SERVER_IP "echo key auth works"
```

## 4. Deploy

```bash
ansible-playbook -i inventory.ini ping.yml
ansible-playbook -i inventory.ini site.yml --ask-vault-pass
```

`site.yml` = provision + deploy + nginx/TLS. Fifteen to twenty minutes on a
fresh server.

**No domain yet?** Set `domain_name` to the server's IP in `inventory.ini` and
`enable_ssl: false` in `group_vars/all/main.yml`. The store runs on plain HTTP
from the IP, and every derived URL follows the scheme automatically. Then run
`site.yml` as above.

Once DNS resolves: set the real hostname and `certbot_email` in
`inventory.ini`, `enable_ssl: true` in `group_vars/all/main.yml`, and run

```bash
ansible-playbook -i inventory.ini nginx.yml    # issues the certificate
ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass   # REQUIRED
```

The second is not optional: the frontend has its API base URL compiled into the
bundle, and only a rebuild changes it.

## 5. Verify

```bash
curl -s https://DOMAIN/health
curl -sI http://DOMAIN | head -1              # 301 to HTTPS
ssh root@SERVER_IP "cat /var/www/jolfa/current/REVISION"
```

Open the site, log in with `vault_admin_seed_phone` / `vault_admin_seed_password`,
**change that password immediately**.

## 6. Backups off-box

```bash
ssh root@SERVER_IP "sudo -u jolfa rclone config"     # create a remote
nano group_vars/all/main.yml                          # backup_remote: "jolfa-backups:jolfa"
ansible-playbook -i inventory.ini backup.yml -e run_now=true
```

## 7. Semaphore (optional, recommended)

```bash
ansible-playbook -i inventory.ini semaphore.yml --ask-vault-pass
ssh -N -L 8888:127.0.0.1:8888 root@SERVER_IP    # then http://localhost:8888
```

Then follow [Part 6.3–6.5](./06-semaphore-ui/03-create-jolfa-project.md) to add
the project, keys and templates.

---

## Day to day

```bash
ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass       # ship
ansible-playbook -i inventory.ini rollback.yml                      # unship
ansible-playbook -i inventory.ini backup.yml -e run_now=true        # backup now
```

---

## Do not forget

- [ ] Change the seeded admin password
- [ ] Set `backup_remote` — otherwise backups die with the server
- [ ] Rehearse a restore ([7.2](./07-day-2-operations/02-backup-and-restore.md))
- [ ] Point an uptime monitor at `/health` ([7.6](./07-day-2-operations/06-scaling-and-monitoring.md))
- [ ] Payments stay in **sandbox** until [going-live.md](./08-reference/going-live.md) is worked through
