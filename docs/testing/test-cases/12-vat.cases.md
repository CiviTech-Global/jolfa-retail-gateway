# 12 — Tax on the Customer's Payment: Test Cases (CR-02)

Source: ROADMAP → Change Requests → CR-02. See `00-INDEX.md` for the ID scheme and layers.

Every case runs through the real routes against Postgres in
`Jolfa-Server/src/modules/orders/tax.test.ts`, except VAT-012.

| ID | Requirement | Layer | Test name | Key assertions |
|---|---|---|---|---|
| VAT-001 | Rate input | Unit | `reads %s` / `refuses %j` | Persian digits, `٫`, `/`, `%`; nothing outside 0–100 or past two decimals |
| VAT-002 | Rounding | Unit | `rounds the tax to a whole Toman` | whole Toman; same cases in `Jolfa-web/src/features/orders/tax.test.ts` |
| VAT-003 | Defaults | Integration | `are seeded switched off, at 9.5%, under the standard name` | off, 950, «مالیات بر ارزش افزوده» |
| VAT-004 | Boot keeps the owner's values | Integration | `do not overwrite what the owner set when the server restarts` | settings survive `ensureDefaultSettings` |
| VAT-005 | Storefront can read them | Integration | `reach the storefront, which has to show the line before the order exists` | all three keys public |
| VAT-006 | Off | Integration | `adds nothing while it is off` | no tax fields; total unchanged |
| VAT-007 | On, items only | Integration | `charges the rate on the items only, and records it on the order` | 100,000 + 80,000 + 9,500 = 189,500 |
| VAT-013 | Delivery not taxed | Integration | `charges the same tax whichever delivery method is chosen` | post and courier both 10,000 tax |
| VAT-008 | Gateway amount | Integration | `asks the gateway for the taxed total, in Rial` | Zibal is asked for 1,900,000 |
| VAT-009 | Custom name, zero rate | Integration | `uses the name the owner chose`, `treats a rate of zero as no tax` | label kept; zero leaves no trace |
| VAT-010 | Placed orders are fixed | Integration | `leaves a placed order alone when the owner changes the rate` | amount, label, rate, total unchanged |
| VAT-011 | Saving | Integration | `stores a typed Persian rate in its plain form`, `refuses a rate it cannot read, and keeps the old one`, `brings the default name back when the field is cleared`, `refuses a name too long to keep on an order` | 400 `INVALID_SETTING_VALUE`; canonical value stored |
| VAT-012 | Live check after switching on | Manual | — | Checkout line, gateway page and order all agree; switching off again leaves that order as it was |
