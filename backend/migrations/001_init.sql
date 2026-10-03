CREATE TABLE IF NOT EXISTS products (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    price       BIGINT      NOT NULL CHECK (price >= 0),
    image       TEXT,
    status      TEXT        NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','HIDDEN')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id             BIGSERIAL PRIMARY KEY,
    order_code     TEXT        NOT NULL UNIQUE,
    total_amount   BIGINT      NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT        NOT NULL DEFAULT 'BANK',
    order_status   TEXT        NOT NULL DEFAULT 'PENDING' CHECK (order_status IN ('PENDING','COMPLETED','CANCELLED')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- product_id is nullable so a product can be deleted without breaking old orders.
-- product_name and unit_price are snapshots taken when the order is created.
CREATE TABLE IF NOT EXISTS order_items (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT   NOT NULL,
    unit_price   BIGINT NOT NULL CHECK (unit_price >= 0),
    quantity     INT    NOT NULL CHECK (quantity > 0),
    subtotal     BIGINT NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- Per-day counter used to build order codes such as LB20261003001.
CREATE TABLE IF NOT EXISTS order_counters (
    day DATE PRIMARY KEY,
    n   INT  NOT NULL
);
