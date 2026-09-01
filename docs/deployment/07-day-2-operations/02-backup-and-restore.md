# 7.2 — Backup and Restore

---

## What is backed up

Both halves of the application's state, together:

| Part | File in the backup |
|---|---|
| PostgreSQL database | `database.dump` (custom format, `pg_dump -Fc`) |
| Uploaded media | `uploads.tar.gz` |
| What this backup is | `manifest.txt` — timestamp, hostname, git commit, paths |

**Why both.** Product images are files on disk, referenced from the database by
path. Restoring only the database gives you a catalogue where every image 404s.
Restoring only the uploads gives you files nothing points at. They are one unit.

The manifest is written **last**. A directory without one is a partial backup,
and `restore.sh` refuses to use it.

---

## The schedule

`roles/backup` installs a cron job for the `jolfa` user at 03:30 Tehran time:

```cron
30 3 * * * BACKUP_DIR=/var/backups/jolfa RETENTION_DAYS=14 \
  BACKUP_REMOTE=... ENV_FILE=/var/www/jolfa/shared/Jolfa-Server/.env \
  /var/www/jolfa/current/scripts/backup.sh >> /var/log/jolfa/backup.log 2>&1
```

Local copies older than 14 days are pruned. `deploy.yml` also takes one before
every migration.

---

## The off-box copy

> **A backup sitting on the machine it is protecting is not a backup.**

If `backup_remote` is empty, every run prints a warning and the backup stays on
the VPS. Disk failure, a bad `rm`, or the provider deleting the instance takes
the backups with it.

Configure it once:

```bash
ssh jolfa
sudo -u jolfa rclone config     # create a remote, e.g. an ArvanCloud S3 bucket
```

Then in `group_vars/all/main.yml`:

```yaml
backup_remote: "jolfa-backups:jolfa"
```

```bash
ansible-playbook -i inventory.ini backup.yml
```

Verify the copy actually lands:

```bash
ssh jolfa "sudo -u jolfa rclone ls jolfa-backups:jolfa | tail -5"
```

---

## Take a backup right now

```bash
ansible-playbook -i inventory.ini backup.yml -e run_now=true
```

Or press **Backup now** in Semaphore. Do this before any manual data edit, any
risky deploy, and any change to the payment or SMS configuration.

---

## Restore

Restoring is **deliberately manual**. It drops every object in the target
database, so it should require an SSH session and a human reading a manifest —
not a button next to Deploy.

### Rehearse it first (do this now, not during an incident)

```bash
ssh jolfa

# 1. A scratch database to restore into
sudo -u postgres createdb jolfa_restore_test

# 2. Pick a backup and read its manifest
ls -1 /var/backups/jolfa
cat /var/backups/jolfa/20260901-033000/manifest.txt

# 3. Restore into the scratch database and a scratch uploads path
sudo -u jolfa /var/www/jolfa/current/scripts/restore.sh \
  /var/backups/jolfa/20260901-033000 \
  --database-url 'postgresql://jolfa_app:PASSWORD@localhost:5432/jolfa_restore_test' \
  --uploads-path /tmp/restore-check

# 4. Prove it worked
sudo -u postgres psql jolfa_restore_test -c "select count(*) from products;"
ls /tmp/restore-check | head

# 5. Clean up
sudo -u postgres dropdb jolfa_restore_test
rm -rf /tmp/restore-check
```

**A backup nobody has restored is a hypothesis.** Rehearse quarterly, and after
any change to the schema or the upload path.

### The real thing

```bash
ssh jolfa

# Stop the API so nothing writes while the schema is being replaced
sudo -u jolfa pm2 stop jolfa-api

sudo -u jolfa /var/www/jolfa/current/scripts/restore.sh \
  /var/backups/jolfa/20260901-033000

sudo -u jolfa pm2 start jolfa-api
curl -s localhost:3001/health
```

With no `--database-url` it restores over production, and it prompts for
confirmation because it drops every object first. `--yes` skips the prompt;
think hard before using it.

### Restoring from the off-box copy

```bash
ssh jolfa
sudo -u jolfa rclone copy jolfa-backups:jolfa/20260901-033000 \
  /var/backups/jolfa/20260901-033000
# then restore as above
```

---

## What is NOT backed up

| Thing | Why it does not matter | What to do |
|---|---|---|
| The code | It is in git | Re-deploy |
| `.env` files | Rendered by Ansible from `group_vars` and the vault | Re-run `deploy.yml` |
| Nginx config | Rendered from a template | Re-run `nginx.yml` |
| TLS certificates | certbot re-issues in seconds | Re-run `nginx.yml` |
| **The Ansible vault password** | **Nothing regenerates it** | Store it in a password manager. Losing it means regenerating every secret and rotating the JWT signing key, which logs every user out |
| Semaphore run history | Lives in a Docker volume | Back up the volume if it matters (see 6.1) |

The vault password is the one irreplaceable thing in this whole system. Treat it
accordingly.
