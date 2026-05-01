-- XThing VPN schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id              TEXT PRIMARY KEY,           -- trial / basic / pro / unlimited
    title           TEXT NOT NULL,
    traffic_bytes   BIGINT,                     -- NULL = unlimited
    duration_days   INT NOT NULL
);

INSERT INTO subscription_plans (id, title, traffic_bytes, duration_days) VALUES
    ('trial',     'Trial',     5368709120,     7),
    ('basic',     'Basic',     53687091200,    30),
    ('pro',       'Pro',       214748364800,   30),
    ('unlimited', 'Unlimited', NULL,           30)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_id         TEXT NOT NULL REFERENCES subscription_plans(id),
    traffic_limit   BIGINT,                     -- NULL = unlimited
    traffic_used    BIGINT NOT NULL DEFAULT 0,
    expires_at      TIMESTAMPTZ NOT NULL,
    activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activation_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash       TEXT NOT NULL UNIQUE,       -- bcrypt(code)
    code_lookup     TEXT NOT NULL UNIQUE,       -- sha256(code) for O(1) lookup
    plan_id         TEXT NOT NULL REFERENCES subscription_plans(id),
    used_by         UUID REFERENCES users(id),
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS servers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    country_code    TEXT NOT NULL,              -- ISO 3166-1 alpha-2
    city            TEXT NOT NULL,
    protocol        TEXT NOT NULL CHECK (protocol IN ('vless', 'hysteria2')),
    address         TEXT NOT NULL,
    port            INT NOT NULL,
    -- Encrypted JSON config (AES-256-GCM, base64). Decrypted client-side.
    config_payload  TEXT NOT NULL,
    load_percent    INT NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connection_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id       UUID REFERENCES servers(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    bytes_up        BIGINT NOT NULL DEFAULT 0,
    bytes_down      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_history_user_started ON connection_history(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS user_routing (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_action  TEXT NOT NULL DEFAULT 'proxy' CHECK (default_action IN ('proxy','direct')),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routing_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('process','ip','domain','regex')),
    value           TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('proxy','direct','block')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_user_sort ON routing_rules(user_id, sort_order);
