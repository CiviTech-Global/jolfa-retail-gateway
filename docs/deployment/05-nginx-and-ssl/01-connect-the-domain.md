# Part 5.1 — Connecting araspro.ir

The store is live on the server's bare IP. This page takes it to `https://araspro.ir`.

Throughout, `<SERVER_IP>` is the production server's address. The real value is in
`ansible/inventory.ini` and `.local/SERVER.md`, neither of which is in git.

Read the whole page before touching anything. Two of these steps are hard to undo
if taken in the wrong order, and both are flagged where they appear.

---

## 0. The diagnosis, and why the obvious advice is wrong

The common advice for "my domain does not open" is *check that nginx knows about
the domain*. On this server that advice does not apply, and following it wastes
the afternoon. The site's nginx block is declared `listen 80 default_server`,
which means nginx answers on **any** hostname pointed at the box. Proof:

```console
$ curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: araspro.ir'     http://<SERVER_IP>/
200
$ curl -s -H 'Host: www.araspro.ir' http://<SERVER_IP>/ | grep -o '<title>[^<]*</title>'
<title>ارس پرو | Araspro</title>
```

nginx has been ready this whole time. Nothing on the server needs to change for
the domain to start working over HTTP.

The break is one layer earlier. A domain reaches a server through a chain, and
each link is owned by a different system:

```
araspro.ir
  │
  ├─ 1. IRNIC (ایرنیک)     the .ir registry: which nameservers hold the domain?
  │
  ├─ 2. Parspack DNS        those nameservers: what records are in the zone?
  │
  ├─ 3. the visitor's resolver
  │
  └─ 4. nginx on the server                                    <- already correct
```

`scripts/dns-check.py` walks the chain and reports each link separately:

```console
$ python3 scripts/dns-check.py araspro.ir <SERVER_IP>
```

Its output for this domain, before the fix:

```
1. DELEGATION — what the .ir registry says (a.nic.ir)
   rcode: NOERROR
   NS  ns2.parspack.co
   NS  ns1.parspack.co
   DNSSEC: no DS record (DNSSEC not in use)

2. ZONE — do those nameservers actually host the zone?
   ns1.parspack.co   195.248.242.94   SOA REFUSED  (control NOERROR)  zone NOT hosted here
   ns2.parspack.co   185.202.113.178  SOA REFUSED  (control NOERROR)  zone NOT hosted here

3. RESOLUTION — what a visitor's resolver returns
   8.8.8.8    araspro.ir    SERVFAIL   []
```

Read it link by link:

- **Link 1 is fine.** IRNIC has the delegation. The domain is registered and
  points at `ns1.parspack.co` and `ns2.parspack.co`.
- **Link 2 is the fault.** Those nameservers answer `REFUSED` for `araspro.ir`.
  The control question in the same breath — asking each server for a zone its
  own provider hosts — comes back `NOERROR`, so the servers are reachable and
  healthy. They are not broken; they simply have no zone by this name.
- **Link 3 is a symptom, not a cause.** `SERVFAIL` is a resolver saying "I found
  the delegation, asked those servers, and got nothing usable." It is what
  `REFUSED` upstream looks like from the outside.

> **`REFUSED` vs `SERVFAIL` vs `NXDOMAIN` — the whole diagnosis is in this word.**
>
> | Response | Meaning | Fix |
> |---|---|---|
> | `REFUSED` from the authoritative NS | "I do not host this zone" | **Create the zone at the DNS provider** ← this case |
> | `NXDOMAIN` | The zone exists; this *name* does not | Add the missing record |
> | `SERVFAIL` at a public resolver | Upstream gave no usable answer | Look upstream — usually `REFUSED` or DNSSEC |
> | No NS at the registry | Not delegated | Set nameservers at IRNIC |

So: **buying a domain and pointing it at a DNS provider does not create a zone
there.** Registration and DNS hosting are separate products, and the second one
was never switched on. That is the entire bug.

### A trap when checking this from Iran

Many Iranian connections intercept UDP port 53 and answer on behalf of whatever
server you addressed. During this investigation a query sent to
`195.248.242.94` came back from `195.248.240.221`. That produces confident,
wrong answers — `nslookup` will not tell you it happened.

`dns-check.py` compares the responding address against the address asked and
prints `<-- ANSWERED BY A DIFFERENT SERVER` when they differ. Two further notes:

- DNS-over-HTTPS (`dns.google`, `cloudflare-dns.com`) is blocked here — those
  hosts do not connect at all, so DoH is not a workaround.
- Plain UDP to `8.8.8.8` and `1.1.1.1` does work and is not intercepted.

---

## 1. Point the delegation at the CDN nameservers

`.ir` is different from `.com`: nameservers live at **IRNIC**, not in the
registrar's panel. Parspack's own documentation says so — for national domains,
"تنظیمات از طریق سامانه ایرنیک انجام می‌شود".

> **The trap: Parspack has two different nameserver fleets, and the obvious pair
> is the wrong one.**
>
> `ns1.parspack.co` / `ns2.parspack.co` are the **shared-hosting** DNS servers,
> and they are what the domain's نیم‌سرورها page shows by default. The **CDN**
> service — where step 2 creates the zone — runs a *separate* fleet on
> `parspack.net`. Records added in the CDN panel land there and nowhere else.
>
> Leave the delegation on the `.co` pair and the result is a zone that is
> perfectly configured and completely unreachable: the `.co` servers answer
> `REFUSED` because the zone genuinely is not theirs, and the world never
> reaches the `.net` servers that hold it.

The zone itself names the pair to use. Ask it directly rather than guessing:

```console
$ python3 scripts/dns-check.py araspro.ir
```

For this domain the answer was:

```
tornado.parspack.net
alluvium.parspack.net
```

Set exactly those at IRNIC:

1. Sign in at <https://eid.nic.ir/> with the account that owns the domain.
2. Find `araspro.ir` and edit its **nserver** entries.
3. Replace both with the pair the zone names.

Parspack's own panel can push this change instead — but **only if the domain
sits under Parspack's IRNIC agent handle**. If the customer registered the
domain under his own IRNIC account, the Parspack panel accepts the change and
silently never applies it, which is indistinguishable from a slow sync. If the
registry has not moved after an hour, do it at `eid.nic.ir` directly.

Two things make this step feel broken when it is not:

- **The registry NS records carry a 900-second TTL.** After IRNIC updates,
  resolvers that already asked keep the old delegation for up to 15 more
  minutes. Do not judge the change in its first quarter hour.
- **IRNIC itself has outages**, and Parspack's panel warns about them. A change
  can sit queued for hours through no fault of the configuration.

Confirm the registry has actually moved before blaming anything else — all four
`.ir` registry servers should agree:

```console
$ python3 scripts/dns-check.py araspro.ir     # section 1 lists the live delegation
```

---

## 2. Create the zone at Parspack — this is the actual fix

Everything else on this page is verification or follow-up. This step is the one
that makes the domain start working.

The goal: get `araspro.ir` **listed as a zone** in Parspack's DNS service, so
that its nameservers stop answering `REFUSED`.

**The DNS editor is not under the domain.** This is the part that wastes the
afternoon. Under **دامنه → araspro.ir → نیم‌سرورها** you will see:

```
NS1: ns1.parspack.co
NS2: ns2.parspack.co
```

That page is the *delegation* — it tells IRNIC where to send queries. It is
already correct, there is nothing to change there, and **it does not create a
zone.** No record editor exists on that page because at Parspack, DNS zones are
not a feature of the domain; they belong to the **CDN service**.

So the zone is created by adding the domain to CDN:

1. Sign in at <https://my.parspack.com/login>.
2. In the right-hand menu choose **CDN** and order it for `araspro.ir`. The free
   plan is sufficient — this is being used as DNS hosting, not as a CDN.
3. Open **سرویس‌های CDN من** (My CDN services) → select `araspro.ir` →
   **مدیریت CDN** (Manage CDN).
4. Open the **DNS** section. The zone now exists, and this is the record editor
   that was missing.
5. Add records with **ایجاد DNS جدید** (Create new DNS) — see step 3 below.

> **Set every record to «DNS only», not proxied.**
>
> Parspack's A records have a proxy toggle, like Cloudflare's. Leave it **off**.
> With proxying on:
> * certbot's HTTP-01 challenge is answered by the CDN edge rather than by our
>   nginx, and certificate issuance fails or certifies the wrong host;
> * every request arrives from a CDN address, so `limit_req_zone
>   $binary_remote_addr` in the vhost rate-limits the CDN instead of the
>   visitor, and fail2ban sees one IP for the whole internet.
>
> Proxying can be switched on later, but only after nginx is configured to trust
> the CDN's forwarded-for header. Do not combine that change with this one.

If the CDN section does not appear, or ordering it does not produce a DNS page,
the service is not enabled for this account and only Parspack can enable it.
Open a ticket:

  > سلام. دامنه `araspro.ir` در ایرنیک روی `ns1.parspack.co` و
  > `ns2.parspack.co` تنظیم شده است، اما این نیم‌سرورها برای این دامنه پاسخ
  > `REFUSED` می‌دهند؛ یعنی زون DNS این دامنه روی سرورهای شما ساخته نشده است.
  > لطفاً سرویس DNS/CDN را برای این دامنه فعال کنید تا بتوانم رکورد A را اضافه کنم.

  That wording matters. "سایتم بالا نمیاد" gets a generic reply about nginx and
  another day is lost. Naming `REFUSED` and "زون ساخته نشده" states the finding.

**Checkpoint.** Before adding records, confirm the zone now exists:

```console
$ python3 scripts/dns-check.py araspro.ir
```

Section 2 must say `zone IS hosted here` for at least one nameserver. If it
still says `REFUSED`, the zone was not created — go back. Adding records to a
zone that does not exist is not possible, and time spent on step 3 before this
checkpoint passes is time wasted.

---

## 3. Add the records

In the zone's record editor:

| Type | Name | Value | TTL |
|---|---|---|---|
| `A` | `@` (or blank) | `<SERVER_IP>` | 300 |
| `A` | `www` | `<SERVER_IP>` | 300 |

Notes that save a round trip:

- **`@` means the bare domain.** Some panels want `@`, some want the field left
  empty, some want `araspro.ir`. They mean the same thing.
- **Use `A` for `www`, not `CNAME`.** A `CNAME` works, but certbot is being
  asked for a certificate covering both names, and a plain `A` on each removes
  a resolution step that can fail independently.
- **Set TTL to 300 (5 minutes) for now.** Default is often 86400 — a full day —
  and any mistake made today then takes a day to correct. Raise it to 3600 once
  the site is confirmed working.
- **Delete any parked/default records** Parspack created pointing at its own
  landing page. A leftover `A @` next to yours means half of visitors reach the
  wrong server, intermittently, which is miserable to debug.
- **Do not add an `AAAA` record.** This one needs stating precisely, because a
  half-check gives the wrong answer. The server *does* have a global IPv6
  address and a default IPv6 route — so `ip -6 addr` alone would tell you to go
  ahead — but IPv6 does not actually reach the internet:

  ```console
  # ip -6 addr show scope global
  inet6 2a00:…:71fc/64 scope global dynamic
  # ip -6 route show default
  default via fe80::… dev eth0 proto ra
  # curl -6 -sI https://ipv6.google.com
  (fails)
  ```

  nginx is listening on `[::]:80`, so an `AAAA` record would look correct in
  every config check and still break the site — but only for visitors whose
  network prefers IPv6, while everyone else sees it working. Verify with an
  actual outbound request, not with `ip -6 addr`, and add `AAAA` only once that
  request succeeds.

---

## 4. Wait, then verify

Propagation is usually minutes, not the "up to 48 hours" that panels warn about.
The TTL of 300 keeps it short.

```console
$ python3 scripts/dns-check.py araspro.ir <SERVER_IP>
```

Proceed only when the verdict line reads:

```
araspro.ir resolves to ['<SERVER_IP>']. Safe to run nginx.yml for the certificate.
```

Then confirm the site itself answers on the name:

```console
$ curl -sI http://araspro.ir/ | head -1
HTTP/1.1 200 OK
```

At this point `http://araspro.ir` works in a browser. HTTPS does not yet.

> **Test in a private window until step 5 is done.**
>
> The site currently sends an HSTS header. Browsers are required to ignore HSTS
> received over plain HTTP, so this is not dangerous — but a private window
> keeps the cache clean while the certificate and the redirect are being put in
> place, and avoids chasing a stale-cache ghost.

---

## 5. Switch the application to the domain

DNS resolving is not the end. The application still has the bare IP compiled
into it: `CORS_ORIGIN`, `APP_URL`, the payment callback, and — critically — the
frontend's API base URL, which Vite **inlines at build time**. Changing a
variable and restarting does nothing; the frontend must be rebuilt.

**Order matters. Read step 6 before running these.**

1. `ansible/inventory.ini` — comment out the IP line, uncomment the domain lines:

   ```ini
   # domain_name=<SERVER_IP>
   # domain_alias=
   domain_name=araspro.ir
   domain_alias=www.araspro.ir
   ```

   Set `domain_alias` **only if `www` actually resolves**. Certbot requests one
   certificate covering both names and fails the entire request if either name
   does not validate — costing one of five attempts per hour.

2. `ansible/group_vars/all/main.yml` — turn SSL on:

   ```yaml
   enable_ssl: true
   ```

   It must be set **here, not in the inventory**. Variables in `group_vars/all`
   outrank group variables written into an inventory file, so a value set there
   is silently ignored — the playbook runs, reports success, and issues no
   certificate.

3. Issue the certificate and rewrite the nginx config:

   ```console
   $ ansible-playbook -i inventory.ini nginx.yml
   ```

4. Rebuild and redeploy the application:

   ```console
   $ ansible-playbook -i inventory.ini deploy.yml
   ```

   **This step is not optional.** Skipping it leaves a frontend served from
   `https://araspro.ir` that calls `http://<SERVER_IP>/api/v1` — blocked by the
   browser as mixed content and as a CORS violation. The site loads and every
   action fails.

> **Let's Encrypt allows five failed validations per hour, per account, per
> hostname.** Burn them and you wait an hour. This is why step 4's checkpoint
> must pass before running `nginx.yml`: the overwhelming cause of a failed
> validation is running certbot before DNS resolves.

---

## 6. Rewrite the stored image URLs — do not skip this

Uploaded images are stored in the database as **absolute URLs** containing the
server's IP. `saveUploadFile` builds them from `APP_URL`:

```ts
url: `${env.APP_URL}${env.PUBLIC_UPLOAD_PATH}/${filename}`
```

So the products table currently holds rows like:

```
"url":"http://<SERVER_IP>/demo-assets/product-07.jpg"
```

Under `https://araspro.ir` every one of those is an insecure request from a
secure page. Chrome blocks them silently. The symptom is a working site with
**no images anywhere**, and nothing in the server logs, because the requests
never leave the browser.

Rewriting the rows is part of the switchover, in the same maintenance window:

```console
$ sudo -u postgres psql -d jolfa
```

Four tables hold these URLs — `product_images.url`, `categories.image_url`,
`banners.image_url`, and any `settings.value` that carries one:

```sql
BEGIN;

-- Inspect first. Never run an UPDATE without seeing the counts.
SELECT 'product_images' AS t, count(*) FROM product_images WHERE url        LIKE 'http://<SERVER_IP>%'
UNION ALL SELECT 'categories',    count(*) FROM categories     WHERE image_url LIKE 'http://<SERVER_IP>%'
UNION ALL SELECT 'banners',       count(*) FROM banners        WHERE image_url LIKE 'http://<SERVER_IP>%'
UNION ALL SELECT 'settings',      count(*) FROM settings       WHERE value     LIKE '%http://<SERVER_IP>%';

UPDATE product_images SET url       = replace(url,       'http://<SERVER_IP>', 'https://araspro.ir') WHERE url       LIKE 'http://<SERVER_IP>%';
UPDATE categories     SET image_url = replace(image_url, 'http://<SERVER_IP>', 'https://araspro.ir') WHERE image_url LIKE 'http://<SERVER_IP>%';
UPDATE banners        SET image_url = replace(image_url, 'http://<SERVER_IP>', 'https://araspro.ir') WHERE image_url LIKE 'http://<SERVER_IP>%';
UPDATE settings       SET value     = replace(value,     'http://<SERVER_IP>', 'https://araspro.ir') WHERE value     LIKE '%http://<SERVER_IP>%';

-- Check the site in a browser BEFORE committing. ROLLBACK if anything is wrong.
COMMIT;
```

`url` and `image_url` are `VARCHAR(500)`; the replacement is shorter than the
original, so nothing can overflow. Take a backup first —
`ansible-playbook -i inventory.ini backup.yml`.

**Until the switch is done, avoid uploading real product photos.** Every upload
adds another row to rewrite.

---

## 7. Afterwards

- Raise the record TTL from 300 to 3600.
- Add `ns3.parspack.co` and `ns4.parspack.co` at IRNIC for redundancy.
- Confirm the certificate renewal timer: `systemctl list-timers | grep certbot`.
- Re-run `scripts/dns-check.py` after any DNS change; it is cheap and it is the
  difference between knowing and guessing.

## Troubleshooting

| Symptom | Where it is | What to do |
|---|---|---|
| `SERVFAIL` everywhere | zone missing, or DNSSEC | Run `dns-check.py`; read section 2 |
| `REFUSED` from the NS | zone not created | Step 2 |
| `REFUSED`, but the CDN panel shows correct records | delegated to `.co` while the zone lives on `.net` | Step 1 — repoint IRNIC at the pair the zone names |
| No NS at the registry | not delegated | Step 1, at IRNIC |
| Resolves to the wrong IP | leftover parked record | Delete it in the zone editor |
| Site loads, images missing | mixed content | Step 6 |
| Site loads, all actions fail | frontend still targets the IP | Re-run `deploy.yml` |
| Certbot fails validation | DNS not ready, or `www` missing | Wait for step 4's checkpoint |
| `nslookup` disagrees with reality | ISP intercepting port 53 | Trust `dns-check.py` |
