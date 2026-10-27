# 11 — Torob Compatibility: Test Cases (CR-01)

Source: ROADMAP → Change Requests → CR-01. See `00-INDEX.md` for the ID scheme and layers.

Torob reads a product page's raw HTML and runs no JavaScript, so every case
below asserts on the response body of `GET /products/:slug`, not on a rendered page.

| ID | Requirement | Layer | Test file | Test name | Key assertions |
|---|---|---|---|---|---|
| TOR-001 | All Torob tags present | Integration | `Jolfa-Server/src/modules/product-page/product-page.test.ts` | `carries every tag Torob asked for` | `product_id` = id, `product_name`, `product_price`/`product_old_price` in Toman, `availability=instock`, `guarantee`, absolute `og:image`, canonical |
| TOR-002 | Shell otherwise intact | Integration | same | `replaces the shell's title and leaves the rest of the shell intact` | one `<title>`; ENAMAD tag, app bundle and `#root` still present |
| TOR-003 | Old price only for a real discount | Integration | same | `sends no old price unless it is really a discount` | no `product_old_price` without, or with a stale, compare price |
| TOR-004 | Out of stock | Integration | same | `reports an empty product as out of stock` | `availability=outofstock`; JSON-LD `OutOfStock` |
| TOR-005 | Guarantee fallback | Integration | same | `uses the shop's default guarantee when the product has none` | product value wins; else `default_guarantee` setting |
| TOR-006 | No guarantee | Integration | same | `omits the guarantee when neither the product nor the shop sets one` | no `guarantee` tag |
| TOR-007 | Structured data currency | Integration | same | `prices the structured data in Rial, since schema.org has no Toman` | `price` × 10, `IRR` |
| TOR-008 | Missing / hidden product | Integration | same | `answers 404 for a missing or hidden product, with the app still loading` | 404, `robots=noindex`, no product tags, bundle present |
| TOR-009 | Escaping | Integration | same | `escapes product text so it cannot inject markup` | no raw `<script>` from the title; `<` inside JSON-LD |
| TOR-010 | Lookup failure | Integration | same | `serves the plain shell when the product lookup fails` | 200, original shell, no product tags |
| TOR-011 | Page headers | Integration | same | `sends headers fit for an HTML page, not the API's` | `text/html`, `no-cache`, no API CSP, not rate-limited by the API bucket |
| TOR-012 | Live check after deploy | Manual | — | — | `curl -s https://araspro.ir/products/<slug> \| grep product_` shows the tags; nginx falls back to the static shell when Node is stopped |
