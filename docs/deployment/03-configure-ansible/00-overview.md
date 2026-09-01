# Part 3 — Configure Ansible for This Customer

Three files. Ten minutes. Everything downstream reads from them.

---

## 3.1 The inventory

```bash
cd ~/jolfa-retail-gateway/ansible
cp inventory.example.ini inventory.ini
nano inventory.ini
```

```ini
[jolfa]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root ansible_ssh_private_key_file=~/.ssh/jolfa_ed25519

[jolfa:vars]
domain_name=shop.example.ir
domain_alias=www.shop.example.ir
certbot_email=ops@example.ir

[semaphore]
jolfa-prod ansible_host=198.51.100.10 ansible_user=root ansible_ssh_private_key_file=~/.ssh/jolfa_ed25519
```

| Variable | Feeds |
|---|---|
| `domain_name` | Nginx `server_name`, the TLS certificate, `CORS_ORIGIN`, `APP_URL`, the payment callback URL, and the frontend's baked-in `VITE_API_BASE_URL` |
| `domain_alias` | An extra `-d` on the certificate and an extra `server_name`. Leave empty if the customer does not own the www record |
| `certbot_email` | Let's Encrypt expiry warnings. Use a mailbox someone reads |

`domain_name` is load-bearing in six places. Setting it once here is the whole
reason those six cannot drift apart.

`inventory.ini` is gitignored.

> **A precedence trap worth knowing once.** Group variables written into an
> inventory file are the *lowest* priority group source — anything in
> `group_vars/all/` outranks them. So a variable that already has an entry in
> `group_vars/all/main.yml` (`enable_ssl`, `pm2_instances`, `backup_remote`, …)
> cannot be overridden from `inventory.ini`; the line is accepted and silently
> ignored. Put per-server facts in the inventory, and configuration in
> `group_vars`. For a one-off, `-e` on the command line beats everything.

### No domain yet?

Set `domain_name` to the server's IP address and `enable_ssl: false` in
`group_vars/all/main.yml`. `site_scheme` follows `enable_ssl`, so `CORS_ORIGIN`,
`APP_URL`, the payment callback and the frontend's compiled-in API base all
become `http://<ip>/…` and agree with each other. The store works on plain HTTP
from the IP.

When DNS arrives: set the real hostname, fill `certbot_email`, set
`enable_ssl: true`, then run `nginx.yml` **and** `deploy.yml`. The second one is
not optional — the frontend has its API base URL compiled into the bundle, and
only a rebuild changes it.

---

## 3.2 The non-secret configuration

Open [`group_vars/all/main.yml`](../../../ansible/group_vars/all/main.yml). Most
of it is fine as shipped. These are the ones worth a decision:

### You must change

```yaml
git_repo: "REPLACE_ME_GIT_URL"     # the customer repository the server clones
git_branch: main
```

For a private repository over SSH, generate a deploy key on the server and add
it to the repository host:

```bash
ssh root@198.51.100.10 "sudo -u jolfa ssh-keygen -t ed25519 -N '' -f /home/jolfa/.ssh/id_ed25519 && cat /home/jolfa/.ssh/id_ed25519.pub"
# paste that key as a read-only deploy key on GitHub/GitLab
```

### You should review

| Variable | Default | Change it when |
|---|---|---|
| `pm2_instances` | `2` | The box has more cores. `max` uses all of them. Remember it multiplies the effective Node rate limit |
| `rate_limit_max` | `150` per worker per minute | You have measured real traffic. This is deliberately below the app's own default of 300 because Nginx is now doing the real limiting |
| `auth_rate_limit_max` | `5` per 15 min | Almost never — this guards credentials and SMS spend |
| `releases_to_keep` | `5` | Disk is tight. Below 2 and rollback has nowhere to go |
| `backup_remote` | `""` | **As soon as the customer has object storage.** An empty value means backups exist only on the machine they are protecting |
| `nginx_client_max_body_size` | `10M` | You raise `max_file_size`. Nginx must be the larger of the two or it 413s a legal upload before Node sees it |

### Left as placeholders on purpose

```yaml
# Payment: sandbox. No real money moves.
payment_gateway: zarinpal
zarinpal_sandbox: "true"
zarinpal_merchant_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# SMS: both empty means reset codes are logged, not sent.
kavenegar_api_key: ""
sms_ir_api_key: ""
```

See [going-live.md](../08-reference/going-live.md) for the checklist when the
customer is ready to switch either of these on.

---

## 3.3 The vault

```bash
cp group_vars/all/vault.example.yml group_vars/all/vault.yml
```

Generate real values — do not invent them:

```bash
openssl rand -hex 32      # vault_jwt_secret
openssl rand -base64 24   # vault_db_password
openssl rand -base64 18   # vault_admin_seed_password
openssl rand -base64 18   # vault_semaphore_admin_password
```

```yaml
vault_db_password: "<openssl output>"
vault_jwt_secret: "<64 hex characters>"
vault_admin_seed_email: "admin@shop.example.ir"
vault_admin_seed_phone: "09120000000"
vault_admin_seed_password: "<openssl output>"
vault_semaphore_admin_password: "<openssl output>"
# left empty while in sandbox
vault_zarinpal_merchant_id: ""
vault_kavenegar_api_key: ""
vault_sms_ir_api_key: ""
```

Encrypt it:

```bash
ansible-vault encrypt group_vars/all/vault.yml
```

`head -1 group_vars/all/vault.yml` should now print
`$ANSIBLE_VAULT;1.1;AES256`.

### Where the vault password itself lives

Not in the repository. Pick one:

- **`--ask-vault-pass`** — you type it each run. Fine for one operator.
- **A password file outside the repo**, referenced by `ANSIBLE_VAULT_PASSWORD_FILE`.
  Convenient; only as safe as your laptop.
- **Semaphore's key store** — Part 6. This is the answer when more than one
  person deploys.

### About `vault_admin_seed_password`

The server creates this admin account on first boot if the phone number is not
already taken. It is a bootstrap credential: log in, change it in the admin UI,
and it stops mattering. Leaving it as the seeded value is the same as publishing
it, because it is in a file several people can decrypt.

---

## 3.4 Confirm the configuration parses

```bash
ansible-playbook -i inventory.ini site.yml --syntax-check
ansible-inventory -i inventory.ini --graph
ansible -i inventory.ini jolfa -m debug -a "var=domain_name" --ask-vault-pass
```

The last command should print the customer's real domain. If it prints
`REPLACE_ME_DOMAIN`, you edited the example file instead of `inventory.ini`.

---

## 3.5 What NOT to commit

`ansible/.gitignore` already covers these, but know why:

| File | Why it stays out |
|---|---|
| `inventory.ini` | The customer's server IP and SSH user |
| `group_vars/all/vault.yml` | Even encrypted, prefer Semaphore's key store. An encrypted file in a public repository is a password-cracking exercise with unlimited time |
| `.vault-pass` | Obviously |

`vault.example.yml` and `inventory.example.ini` are committed, and contain only
`REPLACE_ME_*` values.
