-- Make the catalogue exactly two levels deep: Category -> Subcategory -> Product.
--
-- The schema already allowed a self-referencing category tree of any depth, and
-- allowed a product to hang off any node in it. Nothing enforced a shape, so the
-- rules the storefront and admin now rely on were conventions rather than
-- guarantees:
--
--   1. a subcategory may not have subcategories of its own (max depth 2)
--   2. a product belongs to a subcategory, never to a top-level category
--
-- These are enforced with triggers rather than CHECK constraints because both
-- rules are statements about a *different* row than the one being written — the
-- parent's parent, or the product's category — and a CHECK constraint may only
-- inspect the row in front of it.
--
-- The service layer enforces the same two rules with Persian messages the admin
-- can act on; these triggers are the backstop for everything that does not go
-- through it: a psql session, a Semaphore job, a restore followed by an import.
-- Application validation is what users see, and the database is what is true.

-- ---------------------------------------------------------------------------
-- Step 1 — make the existing data satisfy rule 2 before enforcing it.
-- ---------------------------------------------------------------------------
--
-- Any product sitting directly on a top-level category is moved into a holding
-- subcategory of that same category.
--
-- The holding subcategory is created deliberately visible and obviously
-- provisional rather than guessing where each product belongs. Filing a hair
-- product under whichever subcategory happened to sort first would be a silent,
-- plausible-looking merchandising decision that nobody asked for and nobody
-- would notice was wrong. A category named "طبقه‌بندی‌نشده" is impossible to
-- miss in the admin list, and moving products out of it is a two-click job.
--
-- It is created inactive-safe: `is_active` is true so the products stay
-- reachable on the storefront exactly as they were before this migration.

INSERT INTO categories (id, name, slug, description, parent_id, display_order, is_active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'طبقه‌بندی‌نشده',
    'uncategorised-' || substr(replace(parent.id::text, '-', ''), 1, 8),
    'محصولاتی که پیش از دو سطحی‌شدن دسته‌بندی‌ها مستقیماً در «' || parent.name || '» ثبت شده بودند. آن‌ها را به زیردسته مناسب منتقل کنید و سپس این زیردسته را حذف کنید.',
    parent.id,
    9999,
    TRUE,
    now(),
    now()
FROM categories parent
WHERE parent.parent_id IS NULL
  AND EXISTS (SELECT 1 FROM products p WHERE p.category_id = parent.id);

UPDATE products p
   SET category_id = holding.id,
       updated_at  = now()
  FROM categories holding
  JOIN categories parent ON parent.id = holding.parent_id
 WHERE holding.slug = 'uncategorised-' || substr(replace(parent.id::text, '-', ''), 1, 8)
   AND p.category_id = parent.id;

-- ---------------------------------------------------------------------------
-- Step 2 — rule 1: the tree is at most two levels deep.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION assert_category_depth()
RETURNS TRIGGER AS $$
DECLARE
    grandparent_id uuid;
    child_count    integer;
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- The chosen parent must itself be top-level.
        SELECT parent_id INTO grandparent_id FROM categories WHERE id = NEW.parent_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'category %: parent % does not exist', NEW.id, NEW.parent_id
                USING ERRCODE = 'foreign_key_violation';
        END IF;

        IF grandparent_id IS NOT NULL THEN
            RAISE EXCEPTION
                'category %: parent % is itself a subcategory; the catalogue is two levels deep',
                NEW.id, NEW.parent_id
                USING ERRCODE = 'check_violation';
        END IF;

        -- ...and this category must not already have children, or they would be
        -- pushed to depth three by its demotion.
        SELECT count(*) INTO child_count FROM categories WHERE parent_id = NEW.id;

        IF child_count > 0 THEN
            RAISE EXCEPTION
                'category %: has % subcategories and cannot become a subcategory itself',
                NEW.id, child_count
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_depth_guard ON categories;
CREATE TRIGGER categories_depth_guard
    BEFORE INSERT OR UPDATE OF parent_id ON categories
    FOR EACH ROW EXECUTE FUNCTION assert_category_depth();

-- ---------------------------------------------------------------------------
-- Step 3 — rule 2: products belong to subcategories.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION assert_product_category_is_subcategory()
RETURNS TRIGGER AS $$
DECLARE
    category_parent uuid;
BEGIN
    SELECT parent_id INTO category_parent FROM categories WHERE id = NEW.category_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product %: category % does not exist', NEW.id, NEW.category_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF category_parent IS NULL THEN
        RAISE EXCEPTION
            'product %: category % is top-level; products belong to subcategories',
            NEW.id, NEW.category_id
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_subcategory_guard ON products;
CREATE TRIGGER products_subcategory_guard
    BEFORE INSERT OR UPDATE OF category_id ON products
    FOR EACH ROW EXECUTE FUNCTION assert_product_category_is_subcategory();

-- ---------------------------------------------------------------------------
-- Step 4 — a category that becomes top-level must not still hold products.
-- ---------------------------------------------------------------------------
--
-- Steps 2 and 3 both look at the row being written. Promoting a subcategory that
-- holds products to top level writes only the category row, so neither trigger
-- fires on the products, and the rows would be left violating rule 2.

CREATE OR REPLACE FUNCTION assert_promoted_category_has_no_products()
RETURNS TRIGGER AS $$
DECLARE
    product_count integer;
BEGIN
    IF OLD.parent_id IS NOT NULL AND NEW.parent_id IS NULL THEN
        SELECT count(*) INTO product_count FROM products WHERE category_id = NEW.id;

        IF product_count > 0 THEN
            RAISE EXCEPTION
                'category %: holds % products and cannot become top-level',
                NEW.id, product_count
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_promotion_guard ON categories;
CREATE TRIGGER categories_promotion_guard
    BEFORE UPDATE OF parent_id ON categories
    FOR EACH ROW EXECUTE FUNCTION assert_promoted_category_has_no_products();

-- ---------------------------------------------------------------------------
-- Step 5 — the index the storefront's category pages depend on.
-- ---------------------------------------------------------------------------
--
-- Listing a top-level category joins products to categories on parent_id. There
-- is already an index on parent_id alone; this one lets the planner filter to
-- visible subcategories without visiting the table.

CREATE INDEX IF NOT EXISTS categories_parent_id_is_active_idx
    ON categories (parent_id, is_active);
