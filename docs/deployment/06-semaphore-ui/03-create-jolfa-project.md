# 6.3 — Create the Jolfa Project

A Semaphore **project** is a container for one application's inventories, keys,
repositories and templates. One project per customer.

---

## Create it

1. **New Project** in the top-left project switcher.
2. Name: `Jolfa Retail Gateway`.
3. Alert / Telegram settings: leave off for now (6.7 covers notifications).
4. Create.

You land on an empty dashboard with a left-hand menu: Task Templates,
Inventory, Environment, Key Store, Repositories.

Fill them in that order **backwards** — Key Store first, because everything
else references it.

---

## Add the repository

**Repositories → New Repository**

| Field | Value |
|---|---|
| Name | `jolfa-retail-gateway` |
| URL | The same git URL as `git_repo` in `group_vars/all/main.yml` |
| Branch | `main` |
| Access Key | `None` for a public repo; an SSH key from the Key Store for a private one |

Semaphore clones this repository into the container on each run and executes the
playbook from that checkout. This has an implication worth internalising:

> **Semaphore runs the playbooks as they exist in the repository, not as they
> exist on your laptop.** A change you have not pushed does not exist as far as
> Semaphore is concerned. This is a feature — it means every deploy corresponds
> to a reviewable commit — but it will confuse you exactly once.

### For a private repository

Generate a dedicated read-only deploy key:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/jolfa_semaphore_deploy -C "semaphore-readonly"
cat ~/.ssh/jolfa_semaphore_deploy.pub    # add as a deploy key on GitHub/GitLab
cat ~/.ssh/jolfa_semaphore_deploy        # paste into Semaphore's Key Store
```

Read-only, and separate from the key that reaches the server. If Semaphore is
compromised you want to revoke one credential at a time.

---

## What the project structure will look like when you are done

```text
Project: Jolfa Retail Gateway
├── Key Store
│   ├── jolfa-server-ssh        (SSH key → the VPS)
│   ├── jolfa-vault-password    (Login/Password → the vault passphrase)
│   └── jolfa-repo-deploy       (SSH key → the git repo, if private)
├── Repositories
│   └── jolfa-retail-gateway    (main)
├── Inventory
│   └── jolfa-prod              (static INI, uses jolfa-server-ssh)
├── Environment
│   └── jolfa-defaults          (extra vars, usually empty)
└── Task Templates
    ├── Deploy
    ├── Nginx + SSL
    ├── Backup now
    ├── Rollback
    └── Provision
```

Next: [04 — Inventory and keys](./04-add-inventory-and-keys.md).
