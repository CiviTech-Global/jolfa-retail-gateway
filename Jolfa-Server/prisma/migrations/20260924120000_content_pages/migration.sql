-- Editable content pages (/about, later /contact and /rules).
--
-- These pages were hardcoded in the React bundle, so changing a sentence meant
-- a developer, a commit and a deploy. `/about` was also invisible: the
-- `show_about` setting was off, and the route guard renders 404 when it is, so
-- the page reported itself as missing rather than as switched off.
--
-- Deliberately not part of `homepage_sections`. That table drives a
-- merchandising surface whose sections read live catalogue data; these pages
-- are prose. Sharing one table would force every section type to answer what
-- it means on /about, and would put a schema change in front of the live
-- homepage for no benefit.

CREATE TABLE content_pages (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             varchar(50)  NOT NULL UNIQUE,
    title            varchar(200) NOT NULL,
    meta_title       varchar(200),
    meta_description varchar(500),
    -- An ordered array of typed blocks. Validated by zod on every write, so the
    -- column never receives a shape the renderer cannot draw.
    blocks           jsonb        NOT NULL DEFAULT '[]'::jsonb,
    created_at       timestamptz(6) NOT NULL DEFAULT now(),
    updated_at       timestamptz(6) NOT NULL DEFAULT now()
);

-- The page is looked up by slug on every visit and by nothing else; the UNIQUE
-- constraint above already provides that index, so no extra one is added here.

-- `blocks` must be an array. Without this a malformed write — an object, or a
-- bare string — would be stored happily and only fail in the browser, where the
-- page would render blank with no clue as to why.
ALTER TABLE content_pages
    ADD CONSTRAINT content_pages_blocks_is_array
    CHECK (jsonb_typeof(blocks) = 'array');
