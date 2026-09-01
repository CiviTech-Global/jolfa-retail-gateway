# 7.4 — Rollback

```bash
cd ~/jolfa-retail-gateway/ansible
ansible-playbook -i inventory.ini rollback.yml
```

Or press **Rollback** in Semaphore. Under a minute — it is a symlink change and
a `pm2 reload`.

---

## What it does

1. Lists `releases/`, newest first, and picks the one that is not `current`.
2. Refuses if that release has no `Jolfa-Server/dist/index.js` — a release that
   never finished building is not a rollback target.
3. Points `current` at it.
4. `pm2 reload` and waits for `/health`.

Roll back to a specific release:

```bash
ssh jolfa "ls -1t /var/www/jolfa/releases"
ansible-playbook -i inventory.ini rollback.yml -e target_release=20260831-221000
```

---

## What it does NOT do

**It does not undo database migrations.** Prisma migrations are forward-only;
there is no `migrate down`.

| The bad release... | Rollback is... | Because |
|---|---|---|
| Changed only code | **Sufficient** | Nothing about the schema moved |
| Added a table or column | **Sufficient** | The old code ignores what it does not know about |
| Added a NOT NULL column with no default | **Probably sufficient** | Old code does not write it; new inserts already have the default |
| **Dropped or renamed a column** | **NOT sufficient** | The old code queries something that no longer exists and fails on every request |
| Backfilled or transformed data | **NOT sufficient** | The code goes back; the data does not |

For the last two rows, rollback is only step one. Step two is restoring the
database from the backup `deploy.yml` took immediately before the migration:

```bash
ssh jolfa "ls -1t /var/backups/jolfa | head -3"     # the newest is the pre-deploy one
# then follow 7.2 — Restore
```

This is precisely why `deploy.yml` backs up before migrating, and why
destructive schema changes should ship across three releases (7.1).

---

## Deciding: roll back or fix forward?

| Situation | Do this |
|---|---|
| Checkout or payment is broken | **Roll back now.** Diagnose afterwards |
| Admin panel broken, storefront fine | Fix forward — the customer is still selling |
| A visual bug | Fix forward |
| Health check failed during the deploy | Roll back; the release never worked |
| Broken *and* it ran a destructive migration | Roll back the code, then restore the database. Accept the data loss window and tell the customer |

Bias toward rolling back. It is a minute, it is reversible (re-deploy `main`),
and it buys you the time to diagnose properly instead of shipping a second
guess on top of the first.

---

## After a rollback

1. Tell the customer, if anything customer-visible happened.
2. **Do not leave the branch broken.** The next `deploy.yml` from `main` ships
   the bad release again. Revert the commit or fix it before anyone deploys.
3. Note what happened in the Semaphore run message — that history is the
   incident record.

---

## Nothing to roll back to

If `releases/` has only one directory — a first deploy that went wrong — there is
no previous release. Options, in order of preference:

1. Deploy a known-good tag: `deploy.yml -e git_branch=v1.1.0`.
2. Restore the database from backup and deploy the matching commit — the
   manifest in each backup records the git commit it was taken at.
3. Rebuild the server from scratch: `site.yml`, then restore. This is why
   provisioning is a playbook rather than a memory.
