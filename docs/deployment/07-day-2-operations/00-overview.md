# Part 7 — Day 2 Operations

Everything after the site is live. This is the part to hand to whoever operates
the store.

| Page | When you need it |
|---|---|
| [01 — Deploy an update](./01-deploy-an-update.md) | Weekly |
| [02 — Backup and restore](./02-backup-and-restore.md) | Before anything risky; after anything bad |
| [03 — Logs and troubleshooting](./03-logs-and-troubleshooting.md) | When something is wrong |
| [04 — Rollback](./04-rollback.md) | When a deploy made it wrong |
| [05 — Security hardening checklist](./05-security-hardening-checklist.md) | Before go-live, then quarterly |
| [06 — Scaling and monitoring](./06-scaling-and-monitoring.md) | When one server stops being enough |

---

## The three commands that answer most questions

```bash
ssh jolfa "cat /var/www/jolfa/current/REVISION"          # what is running
ssh jolfa "sudo -u jolfa pm2 list"                       # is it running
ssh jolfa "sudo -u jolfa pm2 logs jolfa-api --lines 50"  # why is it not
```

## The one rule

**Never edit files on the server directly.** Every deploy replaces the release
directory, and every `nginx.yml` run rewrites the vhost. A fix applied by hand
survives until the next deploy and then vanishes, usually at the worst possible
time, and nobody remembers it was there.

Change the template or the variable, commit it, run the playbook. If that feels
too slow for an emergency, the emergency is a reason to roll back, not a reason
to hand-edit.
