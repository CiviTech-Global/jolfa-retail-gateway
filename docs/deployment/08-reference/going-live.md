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

## SMS — Kavenegar / SMS.ir

### Current state

Both keys empty. `sendSms()` records every message in `sms_notifications` with
status `SENT` and a `{provider: "log"}` response, and writes the text to the
server log instead of sending it. The forgot-password flow is fully testable
locally; the code appears in `pm2 logs`.

`isSmsConfigured()` returns false, so callers can warn.

### The switch

1. Customer buys a sender line from Kavenegar or SMS.ir.
2. Fill **exactly one** key in the vault:
   ```yaml
   vault_kavenegar_api_key: "..."
   # or
   vault_sms_ir_api_key: "..."
   ```
3. Set the sender number in `group_vars/all/main.yml`:
   ```yaml
   sms_sender_number: "30002100"
   ```
4. Deploy, then trigger a password reset to your own phone and confirm delivery.
5. Check the record landed:
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

`sendSms()` never throws — a failed SMS must not fail the surrounding request —
so delivery failures are visible only in that table and the log, not to the
user. Check it after enabling.

---

## Order-status notifications

The `sms_notifications` table and `SmsTemplate` type exist, and the sending path
works, but only the `password-reset` template is wired. Notifying customers when
an order ships is a small feature on top of what is already there: add a
template, call `sendSms` from the order status-change service. It is listed in
the roadmap as in-scope and is not done.
