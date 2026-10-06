# Going Live: Payments and SMS

Both are deliberately left as placeholders. This page is the checklist for
switching each one on.

---

## Payments — ZarinPal / Zibal

### Current state

`zarinpal_sandbox: "true"`. The API mints authorities against
`https://sandbox.zarinpal.com/pg/v4` and redirects customers to the sandbox
StartPay host. No real money moves. Orders complete, the ledger records
transactions, the whole flow is exercisable.

The service keeps the API base and the redirect host together in one config
object on purpose: minting an authority against the live API and then sending
the customer to the sandbox to pay it fails every real order, and does so
silently because the redirect itself looks fine.

### Blockers to close first

These are not paperwork. Do not take real money until both are done.

1. **`POST /api/v1/payments/verify` does not verify a gateway signature.** It is
   correctly unauthenticated — it is the gateway's own callback — but it trusts
   the `authority` and `status` it is handed. In sandbox that is theoretical.
   With a live merchant account it is the difference between a paid order and a
   forged one. Implement the gateway's server-to-server verification call
   (ZarinPal `PaymentVerification`, Zibal `verify`) and mark the payment
   complete only on the gateway's own confirmation.
2. **`GET /api/v1/payments/:authority` is not ownership-scoped.** Any
   authenticated user with an authority string can read that payment and its
   order. Add `payment.order.userId === request.user.id || role === ADMIN`.

Both are small changes with obvious test slots — `payment.test.ts` already has
16 tests covering ownership on `/request`, double-spend and replayed callbacks.

### The switch

1. Customer signs the merchant contract and receives a merchant ID.
2. Register the callback URL with the gateway. It must match **exactly**:
   `https://shop.example.ir/api/v1/payments/verify/zarinpal`
3. Put the merchant ID in the vault:
   ```bash
   ansible-vault edit group_vars/all/vault.yml
   # vault_zarinpal_merchant_id: "the-real-id"
   ```
4. In `group_vars/all/main.yml`:
   ```yaml
   zarinpal_sandbox: "false"
   ```
5. Deploy and verify the rendered env:
   ```bash
   ansible-playbook -i inventory.ini deploy.yml --ask-vault-pass
   ssh jolfa "grep ZARINPAL /var/www/jolfa/shared/Jolfa-Server/.env"
   ```
6. **Place one real order for the smallest amount the gateway allows.** Confirm:
   the redirect goes to `www.zarinpal.com` and not the sandbox; the callback
   lands; the order moves to `PROCESSING` and `paymentStatus` to `COMPLETED`;
   the transaction ledger has a `COMPLETED` `PAYMENT` row; the money appears in
   the merchant account.
7. **Test the failure path too.** Cancel at the gateway and confirm the order
   stays `PENDING` with a `FAILED` payment, and that the customer sees a
   sensible Persian message.

### Using Zibal instead

```yaml
payment_gateway: zibal
```
plus `vault_zibal_merchant_id`. Gateway selection is server-global by design —
there is no per-order picker in the checkout UI — so only one is active at a
time.

---

## SMS — SMS.ir

### Current state

With `sms_ir_api_key` empty, `notify()` records every notification in
`sms_notifications` with status `PENDING` and `{provider: "none"}`, and nothing
is sent. The forgot-password flow stays testable: the code is returned as
`devCode` and appears in `pm2 logs`.

Which events send at all, and the wording of the free-text ones, are rows in
`sms_templates` — edited in the admin panel at `/admin/sms`, not in the code.
Seeding is create-only, so a deploy never overwrites the shop owner's wording
nor switches an event back on after they turned it off.

### Two channels, and why it matters

- **VERIFY** (`/v1/send/verify`) — a template registered in the SMS.ir panel,
  sent on a service line. Arrives in seconds and **reaches people who have
  blocked advertising SMS**, which is the only acceptable path for a one-time
  code. Needs the template id, not a line number.
- **BULK** (`/v1/send/bulk`) — free text from the shop's own line. Editable by
  the admin, but needs `sms_sender_number`, and will not reach anyone who has
  blocked advertising.

### The switch

1. Put the web-service key in the vault:
   ```yaml
   vault_sms_ir_api_key: "..."
   ```
2. Set the OTP template id in `group_vars/all/main.yml` (the id shown next to
   the template in the SMS.ir panel):
   ```yaml
   sms_ir_otp_template_id: "683431"
   ```
3. For the order notifications, set the shop's own line as well. `/admin/sms`
   lists the lines the account actually has, under «خطوط موجود در پنل»:
   ```yaml
   sms_sender_number: "30002100"
   ```
4. Confirm the server's IP is in SMS.ir's allowed-IP list, or every call comes
   back rejected.
5. Deploy, open `/admin/sms`, check the credit reads, then use «ارسال آزمایشی»
   on one event and confirm it arrives.
6. Check the record landed:
   ```bash
   ssh jolfa "sudo -u postgres psql jolfa -c \"select phone,status,template,sent_at from sms_notifications order by created_at desc limit 5;\""
   ```

### Cost control

`/auth/forgot-password` spends real money on every request it accepts. Once SMS
is live, two things matter:

- `auth_rate_limit_max: 5` per 15 minutes (per worker) plus the Nginx
  `jolfa_auth` zone at `1r/s burst=5`. Keep both.
- Watch `sms_notifications` for a spike. A sudden run of resets to unrelated
  numbers is someone testing how much of the customer's credit they can burn.

`notify()` never throws — a failed SMS must not fail the surrounding request, or
a completed purchase would become an error page. Delivery failures are visible
in `/admin/sms` under «گزارش ارسال», with the reason SMS.ir gave, and nowhere
else. Check it after enabling.

---

## Which events send

Eight events, all listed in `src/shared/sms/sms-events.ts` and all switchable
from `/admin/sms`:

| Event | Channel | Fires when |
|---|---|---|
| `password_reset_otp` | VERIFY | A reset code is requested |
| `password_changed_by_admin` | BULK | An admin changes someone's password |
| `welcome` | BULK | A customer registers |
| `order_placed` | BULK | An order is created |
| `order_paid` | BULK | A payment settles |
| `order_shipped` | BULK | The admin marks it shipped |
| `order_delivered` | BULK | The admin marks it delivered |
| `order_cancelled` | BULK | The order is cancelled |

The catalogue is code, not data: an event the code never fires cannot be
configured into existence, and a newly added event appears in the panel as soon
as it is deployed. Only `enabled`, the wording and the template id live in the
database.
