# 6.7 — Scheduled Runs

Semaphore can run a template on a cron schedule. Used carefully, this closes the
one real gap in the backup story.

---

## What is already scheduled, and where

The nightly backup is a **cron job on the server**, installed by `roles/backup`,
running as the `jolfa` user at 03:30 Tehran time. It is not a Semaphore
schedule, and that is intentional: a backup must not depend on Semaphore being
up, on Docker being up, or on your laptop.

```bash
ssh jolfa "sudo -u jolfa crontab -l"
```

---

## What is worth scheduling in Semaphore

### A weekly backup verification

The failure mode with backups is never "we forgot to take one" — cron is
reliable. It is "we took 180 of them and none of them restore". A weekly job
that actually exercises a restore into a scratch database is the only thing that
catches a silently broken dump.

**Templates → New Template**

| Field | Value |
|---|---|
| Name | `Verify latest backup` |
| Playbook | `ansible/backup.yml` |
| Extra CLI Arguments | `["-e", "run_now=true"]` |
| Schedule | `0 4 * * 0` (Sundays, 04:00) |

That verifies the backup *runs*. Verifying it *restores* is still a manual
procedure today — see Part 7.3 — and turning it into a playbook is the single
highest-value addition anyone could make to this repository.

### Certificate renewal — deliberately not scheduled

certbot installs its own systemd timer, and `roles/nginx` asserts it is enabled.
Adding a Semaphore schedule on top would be a second mechanism doing the same
job, with two chances to be misconfigured and no way to tell which one renewed
the certificate.

### Deploy on a schedule — do not

Deploys should be caused by a person deciding to ship, not by a clock. A
scheduled deploy at 03:00 that fails its health check leaves the store down
until someone wakes up.

---

## Setting a schedule

On any template: **Schedule → Add**, then a standard five-field cron expression
in the server's timezone (`Asia/Tehran`, set by `roles/common`).

```text
0 4 * * 0      Sundays at 04:00
30 3 * * *     Every day at 03:30
0 */6 * * *    Every six hours
```

---

## Alerts

Set up Telegram alerts (Project Settings) **before** relying on any schedule. An
unattended job whose failure nobody sees is worse than no job, because it
creates a belief that something is being taken care of.

Minimum useful set:

| Template | Alert on |
|---|---|
| `Deploy` | Failure |
| `Verify latest backup` | Failure |
| `Rollback` | Every run — you want to know a rollback happened at all |
