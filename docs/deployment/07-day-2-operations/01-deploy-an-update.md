# 7.1 — Deploy an Update

## The normal path

```bash
cd ~/jolfa-retail-gateway/ansible
ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass
```

Or press **Deploy** in Semaphore.

Three to six minutes. The site stays up throughout: the build happens in a new
release directory, and only a `pm2 reload` at the end touches the running
service — a rolling restart that drains in-flight requests.

---

## Before you deploy

| Check | Why |
|---|---|
| CI is green on the commit you are shipping | The pipeline runs lint, 133 backend tests against a real Postgres, 14 frontend tests, both builds, and an `npm audit` gate |
| You know whether the release contains a migration | `git diff --stat HEAD origin/main -- Jolfa-Server/prisma/migrations/` |
| If it does: is the migration destructive? | A dropped or renamed column makes rollback insufficient. See below |

### Destructive migrations

Rollback puts the **code** back. Nothing puts the **data** back except the
backup. So a migration that drops or renames a column should ship as two
releases:

1. Release A adds the new shape and writes to both.
2. Release B moves the reads over.
3. Release C, later, drops the old shape.

Between A and C, rolling back is always safe. That is the whole point of the
sequence, and it costs one extra deploy.

---

## Deploying something other than `main`

```bash
# A tag
ansible-playbook -i inventory.ini deploy.yml -e git_branch=v1.2.0

# A hotfix branch
ansible-playbook -i inventory.ini deploy.yml -e git_branch=hotfix/checkout-total
```

In Semaphore, use the branch override in the launch dialog.

---

## A hotfix in a hurry

```bash
ansible-playbook -i inventory.ini deploy.yml \
  -e git_branch=hotfix/x -e pre_deploy_backup=false
```

Skipping the backup saves 30–60 seconds. Only do it when you are certain the
release contains no migration — check first:

```bash
git diff --name-only main hotfix/x -- Jolfa-Server/prisma/
```

Empty output means no schema change and skipping is safe.

---

## After the deploy

```bash
curl -s https://shop.example.ir/health
ssh jolfa "cat /var/www/jolfa/current/REVISION"
```

Then click through the two flows that matter, because no automated check covers
them end to end today:

1. Add a product to the cart and reach the payment redirect.
2. Log into the admin panel and open the dashboard.

---

## What a deploy does NOT do

- **It does not restart PostgreSQL.** Database configuration changes come from
  `provision.yml`.
- **It does not touch the Nginx vhost.** That is `nginx.yml`.
- **It does not seed demo data.** The admin panel has a Demo Data page for that.
- **It does not change the admin password.** `ADMIN_SEED_*` only creates the
  account if the phone number is free.
