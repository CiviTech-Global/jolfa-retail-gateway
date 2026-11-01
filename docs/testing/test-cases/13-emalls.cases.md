# 13 — Emalls Product Feed: Test Cases (CR-03)

Source: ROADMAP → Change Requests → CR-03. See `00-INDEX.md` for the ID scheme and layers.

All in `Jolfa-Server/src/modules/feeds/emalls.test.ts`, except EML-010.

| ID | Requirement | Layer | Test name | Key assertions |
|---|---|---|---|---|
| EML-001 | Response shape | Integration | `answers in the content type and shape Emalls asks for` | `application/json; charset=utf-8`; no API envelope |
| EML-002 | Product fields | Integration | `sends every field of a product under the name Emalls uses` | exact object, prices in Toman |
| EML-003 | Optional fields | Integration | `leaves optional fields out rather than sending them empty`, `sends no old price for a stale compare price`, `uses the shop's default guarantee when the product has none` | omitted when empty |
| EML-004 | Stock and image | Integration | `reports stock as a yes or no`, `sends the primary image, as an absolute address` | boolean; absolute URL |
| EML-005 | What is listed | Integration | `leaves out hidden products, and products with no image to send` | counts agree with the list |
| EML-006 | Paging | Integration | `walks the whole catalogue once, with no gaps or repeats`, `answers an empty page past the end, without an error`, `answers an empty shop as a valid response` | no gaps, no repeats |
| EML-007 | Odd input | Integration | `falls back to sensible paging for odd values, and caps the page size` | 200 always; at most 200 per page |
| EML-008 | POST | Integration | `reads the query string with %s` | no body, empty JSON, JSON and form bodies all 200 |
| EML-009 | Crawler access | Integration | `is not stopped by the API's per-IP limit part-way through a crawl`, `is left open to crawlers by robots.txt` | no rate-limit headers; `Allow` before `Disallow` |
| EML-010 | Live check after deploy | Manual | — | `curl -s 'https://araspro.ir/api/v1/feeds/emalls?page=1&item_per_page=2'` |
