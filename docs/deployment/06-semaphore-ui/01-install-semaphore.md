# 6.1 — Install Semaphore

```bash
cd ~/jolfa-retail-gateway/ansible
ansible-playbook -i inventory.ini semaphore.yml --ask-vault-pass
```

Two to four minutes: Docker via the official script, then the Semaphore
container.

---

## What the playbook does

| Step | Detail |
|---|---|
| Installs Docker | The official `get.docker.com` script, guarded by `creates: /usr/bin/docker` so it runs once |
| Creates `/opt/semaphore` | Mode `0750` |
| Renders `docker-compose.yml` | Mode `0600`, `no_log: true` — it contains the admin password |
| `docker compose up -d` | Starts the container |
| Waits for `/api/ping` | Twenty attempts, three seconds apart |
| Prints the tunnel command | Because there is no public port to give you |

---

## Why the app is not in Docker but Semaphore is

VerifyWise ships as a Docker Compose stack, so its playbooks copy compose files
and run `docker compose up`. Jolfa has no Dockerfile — it builds with
`npm run build` and runs under PM2, which is why `roles/app` installs Node
natively.

Semaphore is different: upstream distributes it as a container and nothing else.
Running it that way is following the grain of the tool, and it keeps a Python
and Ansible installation the application does not need off the host.

---

## The compose file

Rendered from
[`roles/semaphore/templates/semaphore-compose.yml.j2`](../../../ansible/roles/semaphore/templates/semaphore-compose.yml.j2):

```yaml
services:
  semaphore:
    image: semaphoreui/semaphore:v2.10.34
    restart: unless-stopped
    ports:
      - "127.0.0.1:8888:3000"      # loopback only — see below
    environment:
      SEMAPHORE_DB_DIALECT: bolt
      SEMAPHORE_ADMIN: admin
      SEMAPHORE_ADMIN_PASSWORD: <from the vault>
      ...
    volumes:
      - semaphore-data:/etc/semaphore
      - semaphore-tmp:/tmp/semaphore
```

Three deliberate choices:

**`127.0.0.1:8888:3000`, not `8888:3000`.** The second form publishes the port
on every interface. Docker writes its own iptables/nftables rules that bypass
the host firewall, so `firewall-cmd --list-all` would still say the port is
closed while the whole internet could reach the login form. Binding the host
side to loopback is what actually closes it.

**The image tag is pinned.** `:latest` means a `docker compose pull` six months
from now silently changes the version, possibly the database schema with it.

**BoltDB.** A single embedded file, no separate database container. Right for
one project. If this becomes a shared instance for several customers, switch
`SEMAPHORE_DB_DIALECT` to `postgres` and give it its own database — migrating
later is more work than starting there.

---

## Verify

```bash
ssh root@198.51.100.10 <<'CHECK'
  docker ps --filter name=semaphore --format '{{.Names}} {{.Status}} {{.Ports}}'
  curl -s -o /dev/null -w '%{http_code}\n' localhost:8888/api/ping
CHECK
```

You want the container `Up`, its ports shown as `127.0.0.1:8888->3000/tcp`, and
`200` or `204` from the ping.

Confirm it is **not** reachable from outside — this should time out or refuse:

```bash
curl -m 5 http://198.51.100.10:8888/
```

---

## Changing the admin password later

Semaphore only applies `SEMAPHORE_ADMIN_PASSWORD` when it creates the account.
Changing the vault value and re-running the playbook does nothing to an existing
user. Change it in the Semaphore UI (User settings), or:

```bash
ssh root@198.51.100.10 \
  "docker exec -it semaphore semaphore user change-by-login --login admin --password 'NEW' --config /etc/semaphore/config.json"
```

---

## Upgrading

```bash
# Bump semaphore_image in group_vars/all/main.yml, then:
ansible-playbook -i inventory.ini semaphore.yml --ask-vault-pass
```

Back up the volume first if the run history matters:

```bash
ssh root@198.51.100.10 \
  "docker run --rm -v semaphore_semaphore-data:/d -v /root:/b alpine tar czf /b/semaphore-data.tar.gz -C /d ."
```
