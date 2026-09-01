# Command Reference

Assumes the `~/.ssh/config` alias from 6.2 (`Host jolfa`) and that you are in
`~/jolfa-retail-gateway/ansible`.

---

## Ansible

```bash
ansible-playbook -i inventory.ini ping.yml                    # connectivity + server facts
ansible-playbook -i inventory.ini provision.yml --ask-vault-pass
ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass
ansible-playbook -i inventory.ini nginx.yml
ansible-playbook -i inventory.ini nginx.yml -e enable_ssl=false
ansible-playbook -i inventory.ini rollback.yml
ansible-playbook -i inventory.ini backup.yml -e run_now=true
ansible-playbook -i inventory.ini semaphore.yml --ask-vault-pass
ansible-playbook -i inventory.ini site.yml --ask-vault-pass    # provision + deploy + nginx

# Deploy a specific ref
ansible-playbook -i inventory.ini deploy.yml -e git_branch=v1.2.0

# Preview / inspect
ansible-playbook -i inventory.ini deploy.yml --check --diff
ansible-playbook -i inventory.ini site.yml --syntax-check
ansible-inventory -i inventory.ini --graph
ansible -i inventory.ini jolfa -m debug -a "var=domain_name" --ask-vault-pass

# Ad hoc
ansible -i inventory.ini jolfa -m shell -a "uptime" --become
```

## Vault

```bash
ansible-vault encrypt group_vars/all/vault.yml
ansible-vault edit    group_vars/all/vault.yml
ansible-vault view    group_vars/all/vault.yml
ansible-vault rekey   group_vars/all/vault.yml    # change the passphrase

openssl rand -hex 32       # JWT secret
openssl rand -base64 24    # database password
```

---

## On the server

### Application

```bash
ssh jolfa "cat /var/www/jolfa/current/REVISION"        # what commit is live
ssh jolfa "ls -1t /var/www/jolfa/releases"             # available rollback targets
ssh jolfa "sudo -u jolfa pm2 list"
ssh jolfa "sudo -u jolfa pm2 logs jolfa-api --lines 100"
ssh jolfa "sudo -u jolfa pm2 restart jolfa-api"
ssh jolfa "sudo -u jolfa pm2 monit"                    # live CPU/memory
ssh jolfa "curl -s localhost:3001/health"
```

### Nginx

```bash
ssh jolfa "nginx -t && systemctl reload nginx"
ssh jolfa "tail -50 /var/log/nginx/error.log"
ssh jolfa "grep 'limiting requests' /var/log/nginx/error.log | tail"
ssh jolfa "certbot certificates"
ssh jolfa "certbot renew --dry-run"
```

### Database

```bash
ssh jolfa "sudo -u postgres /usr/pgsql-16/bin/psql jolfa -c 'select count(*) from products;'"
ssh jolfa "sudo -u postgres /usr/pgsql-16/bin/psql jolfa -c '\\dt'"

# Size on disk
ssh jolfa "sudo -u postgres /usr/pgsql-16/bin/psql -c \"select pg_size_pretty(pg_database_size('jolfa'));\""

# Active connections
ssh jolfa "sudo -u postgres /usr/pgsql-16/bin/psql -c 'select count(*) from pg_stat_activity;'"

# Migration status
ssh jolfa "cd /var/www/jolfa/current/Jolfa-Server && sudo -u jolfa npx prisma migrate status"
```

### Backups

```bash
ssh jolfa "ls -1t /var/backups/jolfa | head"
ssh jolfa "cat /var/backups/jolfa/<timestamp>/manifest.txt"
ssh jolfa "tail -30 /var/log/jolfa/backup.log"
ssh jolfa "sudo -u jolfa rclone ls jolfa-backups:jolfa | tail"
```

### Health of the box

```bash
ssh jolfa "df -h /; free -h; uptime"
ssh jolfa "du -sh /var/www/jolfa/releases/* /var/backups/jolfa /var/log/*"
ssh jolfa "ss -tlnp | grep LISTEN"
ssh jolfa "firewall-cmd --list-all"
ssh jolfa "getenforce; getsebool httpd_can_network_connect"
```

### Semaphore

```bash
ssh -N jolfa                                      # tunnel, then http://localhost:8888
ssh jolfa "docker ps --filter name=semaphore"
ssh jolfa "docker logs --tail 50 semaphore"
ssh jolfa "cd /opt/semaphore && docker compose restart"
```

---

## Local development

```bash
cd Jolfa-Server && npm run dev          # http://localhost:3001
cd Jolfa-web    && npm run dev          # http://localhost:5173

cd Jolfa-Server && npm run test:run     # 133 tests, needs a Postgres
cd Jolfa-web    && npm run test:run
cd Jolfa-Server && npm run lint
```
