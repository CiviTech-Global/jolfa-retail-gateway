# 6.6 — Run the First Job

---

## Run it

**Task Templates → Deploy → Run.**

The launch dialog offers a message (write what you are shipping — it appears in
the history), a branch override, and extra CLI arguments. Accept the defaults
and press Run.

Output streams live. You are watching for the same task names you saw on the
command line in Part 4.

---

## Reading the output

```text
PLAY [Deploy Jolfa Retail Gateway] *********************************************

TASK [Refuse to deploy with an unconfigured repository] ************************
ok: [jolfa-prod]

TASK [Back up before migrating] ************************************************
changed: [jolfa-prod]

TASK [app : Check out the release] *********************************************
changed: [jolfa-prod]

TASK [app : Build the frontend] ************************************************
changed: [jolfa-prod]

TASK [app : Verify the frontend was built against the right API URL] ***********
ok: [jolfa-prod]

TASK [app : Point `current` at the new release] ********************************
changed: [jolfa-prod]

TASK [app : Wait for the API health endpoint] **********************************
ok: [jolfa-prod]

TASK [app : Report the deployed revision] **************************************
ok: [jolfa-prod] => {
    "msg": "Deployed a1b2c3d4 on branch main as release 20260901-104500 — https://shop.example.ir"
}

PLAY RECAP *********************************************************************
jolfa-prod    : ok=24  changed=14  unreachable=0  failed=0  skipped=1
```

`failed=0` and a health check that passed is the whole success criterion.

Then confirm from outside:

```bash
curl -s https://shop.example.ir/health
```

---

## Common first-run failures

| Error | Cause | Fix |
|---|---|---|
| `Decryption failed` on a `group_vars` file | Vault Password not attached, or wrong passphrase | Set it on the template (6.5) |
| `Permission denied (publickey)` at the very first task | Key Store key is truncated or has the wrong username | Re-paste the whole key including BEGIN/END lines |
| `Could not find or access 'server.env.j2'` | Playbook path is wrong — Semaphore runs from the repo root | Use `ansible/deploy.yml`, not `deploy.yml` |
| `git_repo is still a placeholder` | `group_vars/all/main.yml` was never updated, or the change is unpushed | Push it. Semaphore reads the repository, not your laptop |
| The deploy succeeds but the site is unchanged | You deployed a branch that does not have the change | Check the resolved SHA in the "Report the deployed revision" line |

---

## The history is the point

Every run is kept: who started it, when, the commit message they typed, the full
output, and the duration. When someone asks "what changed on Tuesday", this is
the answer, and it is more reliable than anyone's memory of what they typed into
a terminal.

Encourage the habit of writing a real message at launch —
`fix: checkout total excluded shipping` — rather than leaving it blank.
