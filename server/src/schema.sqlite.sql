-- XThing VPN — SQLite-совместимая схема (для Windows-friendly dev-режима)
-- ID и даты генерируются на стороне приложения и приходят как TEXT.

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    is_admin        INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    traffic_bytes   INTEGER,
    duration_days   INTEGER NOT NULL
);

INSERT OR IGNORE INTO subscription_plans (id, title, traffic_bytes, duration_days) VALUES
    ('trial',     'Trial',     5368709120,    7),
    ('basic',     'Basic',     53687091200,   30),
    ('pro',       'Pro',       214748364800,  30),
    ('unlimited', 'Unlimited', NULL,          30);

CREATE TABLE IF NOT EXISTS subscriptions (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_id         TEXT NOT NULL REFERENCES subscription_plans(id),
    traffic_limit   INTEGER,
    traffic_used    INTEGER NOT NULL DEFAULT 0,
    expires_at      TEXT NOT NULL,
    activated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activation_keys (
    id              TEXT PRIMARY KEY,
    code_hash       TEXT NOT NULL UNIQUE,
    code_lookup     TEXT NOT NULL UNIQUE,
    plan_id         TEXT NOT NULL REFERENCES subscription_plans(id),
    used_by         TEXT REFERENCES users(id),
    used_at         TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS servers (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    country_code    TEXT NOT NULL,
    city            TEXT NOT NULL,
    protocol        TEXT NOT NULL CHECK (protocol IN ('vless', 'hysteria2')),
    address         TEXT NOT NULL,
    port            INTEGER NOT NULL,
    config_payload  TEXT NOT NULL,
    load_percent    INTEGER NOT NULL DEFAULT 0,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS connection_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    server_id       TEXT REFERENCES servers(id),
    started_at      TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at        TEXT,
    bytes_up        INTEGER NOT NULL DEFAULT 0,
    bytes_down      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_history_user_started ON connection_history(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    expires_at      TEXT NOT NULL,
    revoked         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_routing (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_action  TEXT NOT NULL DEFAULT 'proxy' CHECK (default_action IN ('proxy','direct')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routing_rules (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL CHECK (kind IN ('process','ip','domain','regex')),
    value           TEXT NOT NULL,
    action          TEXT NOT NULL CHECK (action IN ('proxy','direct','block')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    enabled         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_routing_user_sort ON routing_rules(user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
