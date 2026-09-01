# Glossary

| Term | Meaning |
|---|---|
| **Control machine** | Your laptop — specifically the Ubuntu inside WSL — where Ansible runs |
| **Target server / managed node** | The customer's VPS |
| **Agentless** | Nothing is installed on the server to support Ansible; it works over plain SSH |
| **Inventory** | The file listing servers and their per-host variables |
| **Playbook** | A YAML file mapping hosts to the work to do on them |
| **Role** | A reusable bundle of tasks, templates and handlers (`roles/nginx`, `roles/app`) |
| **Task** | One action — install a package, render a template, make a symlink |
| **Handler** | A task that runs only if something notified it, once, at the end (`Reload nginx`) |
| **Idempotent** | Running it twice leaves the same result. The property that makes re-running safe |
| **Fact** | Something Ansible discovered about the server (`ansible_memtotal_mb`) |
| **Template / Jinja2** | A file with `{{ placeholders }}` rendered per-server before being copied |
| **group_vars** | Variables shared by every host in a group |
| **Ansible Vault** | Encrypted YAML for secrets. The file is safe to commit; the passphrase is not |
| **`become`** | Run as another user, usually root, via sudo |
| **`--check`** | Dry run: report what would change, change nothing |
| **`serial: 1`** | Act on one host at a time, so the others keep serving |
| **Semaphore UI** | A web dashboard that runs `ansible-playbook` and keeps the history |
| **Semaphore template** | A saved (repository + playbook + inventory + variables). The button |
| **Key Store** | Where Semaphore keeps SSH keys and the vault password |
| **Release** | One timestamped directory under `releases/`, built by one deploy |
| **`current`** | The symlink pointing at the live release. A deploy moves it; a rollback moves it back |
| **`shared/`** | State that must outlive any single release: env files, uploads, the PM2 config |
| **PM2** | The Node process manager. Runs the API in cluster mode and restarts it on boot |
| **Cluster mode** | Several Node processes behind PM2's load balancer, one per core |
| **Rolling reload** | Restarting workers one at a time so the service never fully stops |
| **Graceful shutdown** | Finishing in-flight requests on `SIGTERM` before exiting |
| **certbot** | The Let's Encrypt client. Edits the nginx vhost to add TLS |
| **HSTS** | A header telling browsers to only ever use HTTPS for this domain |
| **`limit_req_zone`** | Nginx's rate limiter. Authoritative here, because the app's is per worker |
| **`stale-while-revalidate`** | Serve the cached copy while fetching a fresh one, so a refresh never blocks a shopper |
| **IDOR** | Insecure Direct Object Reference — reading someone else's record by guessing or observing its id |
| **Forward-only migration** | A schema change with no automated way back. All Prisma migrations are this |
| **rclone** | The tool that copies backups off the server to object storage |
| **Manifest** | The file written last in each backup. Its absence means the backup is partial |
