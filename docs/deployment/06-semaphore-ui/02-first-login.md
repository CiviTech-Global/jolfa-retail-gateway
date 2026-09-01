# 6.2 — First Login

Semaphore listens on the server's loopback interface. There is no public URL.
You reach it by forwarding the port over SSH.

---

## Open the tunnel

From WSL (or PowerShell — the syntax is the same):

```bash
ssh -N -L 8888:127.0.0.1:8888 -i ~/.ssh/jolfa_ed25519 root@198.51.100.10
```

- `-L 8888:127.0.0.1:8888` — traffic to `localhost:8888` on your laptop comes
  out of the SSH connection on the server and goes to `127.0.0.1:8888` there.
- `-N` — do not run a shell; just hold the tunnel open.

Leave that terminal open. Closing it closes the tunnel.

Then open **http://localhost:8888** in your browser.

> **Why a tunnel rather than opening a port.** Semaphore holds the SSH key to
> the production server and the vault password. A login form on the public
> internet guarding those is a worse risk than the inconvenience of a tunnel —
> and the tunnel already requires the SSH key, so it is strictly stronger
> authentication than any password Semaphore could check.

---

## Log in

| Field | Value |
|---|---|
| Username | `admin` (the `semaphore_admin_user` variable) |
| Password | `vault_semaphore_admin_password` from your vault |

Read it back if you have forgotten:

```bash
cd ~/jolfa-retail-gateway/ansible
ansible-vault view group_vars/all/vault.yml | grep semaphore
```

---

## First things to do after logging in

1. **Change the admin password** in User Settings, if more than one person will
   have the vault. The vault value is a bootstrap credential.
2. **Create a separate user for the customer's operator.** Give them their own
   login rather than sharing `admin`, or the run history cannot tell you who
   deployed.
3. **Check the version** in the footer matches the image you pinned.

---

## Making the tunnel less tedious

Add to `~/.ssh/config` in WSL:

```sshconfig
Host jolfa
    HostName 198.51.100.10
    User root
    IdentityFile ~/.ssh/jolfa_ed25519
    LocalForward 8888 127.0.0.1:8888
```

Then the tunnel is just:

```bash
ssh -N jolfa
```

And ordinary SSH is `ssh jolfa`.

---

## If the page does not load

| Symptom | Check |
|---|---|
| Connection refused on `localhost:8888` | The tunnel terminal is not open, or it exited |
| Tunnel opens, page hangs | Container is down: `ssh jolfa "docker ps -a --filter name=semaphore"` |
| `bind: Address already in use` | Something else on your laptop uses 8888. Use another local port: `-L 9999:127.0.0.1:8888` |
| Login rejected | Wrong password; read it from the vault, or reset it (see 6.1) |
