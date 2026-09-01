# 6.4 — Inventory and Keys

---

## Key Store

**Key Store → New Key.** Three entries.

### 1. The server SSH key

| Field | Value |
|---|---|
| Name | `jolfa-server-ssh` |
| Type | `SSH Key` |
| Username | `root` |
| Private Key | The **contents** of `~/.ssh/jolfa_ed25519` |

Paste the whole file, including the `-----BEGIN OPENSSH PRIVATE KEY-----` and
`-----END-----` lines and the trailing newline. A truncated key fails with a
misleading "invalid format" error.

```bash
cat ~/.ssh/jolfa_ed25519      # copy all of it
```

### 2. The vault password

| Field | Value |
|---|---|
| Name | `jolfa-vault-password` |
| Type | `Login with password` |
| Login | leave blank |
| Password | the passphrase you used with `ansible-vault encrypt` |

Semaphore passes this to `ansible-playbook --vault-password-file`, which is what
lets a template decrypt `group_vars/all/vault.yml` without anyone typing
anything.

### 3. The repository deploy key (private repositories only)

| Field | Value |
|---|---|
| Name | `jolfa-repo-deploy` |
| Type | `SSH Key` |
| Username | `git` |
| Private Key | the read-only deploy key from 6.3 |

---

## Inventory

**Inventory → New Inventory**

| Field | Value |
|---|---|
| Name | `jolfa-prod` |
| User Credentials | `jolfa-server-ssh` |
| Sudo Credentials | *(none — the key logs in as root)* |
| Type | `Static` |
| Inventory | paste the INI below |

```ini
[jolfa]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root

[jolfa:vars]
domain_name=shop.example.ir
domain_alias=www.shop.example.ir
certbot_email=ops@example.ir

[semaphore]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root
```

Note what is **absent**: `ansible_ssh_private_key_file`. Semaphore supplies the
key from the Key Store; a path here would point at a file inside the container
that does not exist.

> Keep this inventory and your local `inventory.ini` in step. They are two
> copies of the same facts, and the failure mode when they drift — a deploy that
> renders `CORS_ORIGIN` for the wrong domain — is quiet and confusing. If that
> bothers you, switch the Semaphore inventory Type to `File` and point it at a
> committed `ansible/inventory.prod.ini`, so git is the single source.

---

## Environment

**Environment → New Environment**

| Field | Value |
|---|---|
| Name | `jolfa-defaults` |
| Extra variables (JSON) | `{}` |

Semaphore passes this as `-e`. Leave it empty: everything belongs in
`group_vars`, where it is versioned and reviewable, rather than in a web form
nobody diffs.

The exception is a per-run override — deploying a tag, say — which belongs on
the template that needs it (6.5), or in the "Extra CLI Arguments" box at launch
time.

---

## Verify before building templates

Create one throwaway template pointing at `ping.yml` with this inventory, run
it, and confirm it prints the server facts. If the SSH key or the inventory is
wrong, you want to find out on a playbook that changes nothing.

Next: [05 — Create the templates](./05-create-templates.md).
