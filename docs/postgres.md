# PostgreSQL migration

FGx currently runs on **SQLite** via Node's built-in `node:sqlite`
(`src/database/`). This is deliberate: zero dependencies, synchronous,
transactional, and it works on any Node ≥ 22.5 host — ideal for the
single-instance bot today.

The 2026 platform target is **PostgreSQL**. This document is the
integration interface: what the swap requires, exactly, so it can be done
in one clean PR without breaking the running bot. Per project rules, we do
not ship half-migrations or pretend a feature exists before it works.

## Why this is a real migration, not a config change

The repository layer (`src/database/repos/*`) is written against the
**synchronous** `node:sqlite` API:

```js
db.get('SELECT * FROM guild_config WHERE guild_id = ?', guildId);
db.run('INSERT ... VALUES (?, ?)', a, b);
transaction(() => { db.exec('...'); });
```

The `pg` driver is **asynchronous**. A thin adapter cannot paper over
that — every repo function, every service, and every command that calls
one would have to become `async` in the same commit. That is the
migration, and it is why it is staged rather than done opportunistically.

## Interface contract (what callers depend on)

Keep `src/database/index.js` as the single seam. Today it exports:

| Member | Shape |
| --- | --- |
| `db.get(sql, ...params)` | first row or `undefined` |
| `db.all(sql, ...params)` | array of rows |
| `db.run(sql, ...params)` | `{ changes, lastInsertRowid }` |
| `db.exec(sql)` | run statements |
| `transaction(fn)` | run `fn` atomically |

If a future PostgreSQL adapter preserves this surface *exactly* (making
the repo layer async-compatible), all higher layers keep working. The
`?` placeholders are positional, matching `pg`'s `$1, $2, …` — a
placeholder rewriter is the only syntactic difference.

## Schema port (SQLite → PostgreSQL)

`src/database/schema.js` holds migrations. Port mapping:

| SQLite | PostgreSQL |
| --- | --- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` |
| `INTEGER` | `INTEGER` / `BIGINT` |
| `TEXT` | `TEXT` |
| `BOOLEAN` | `BOOLEAN` |
| `REAL` | `DOUBLE PRECISION` |
| `TEXT` (JSON columns) | `JSONB` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT now()` |
| `COLLATE NOCASE` | `LOWER(col)` comparisons / `citext` |
| `ON CONFLICT(...) DO UPDATE` | identical syntax |

Notes:

- `lastInsertRowid` → `RETURNING id` on INSERTs (or `lastval()` for
  plain serial inserts).
- `transaction()` → `BEGIN` / `COMMIT` / `ROLLBACK` on a checked-out
  `pg.Client`.
- WAL/`busy_timeout` PRAGMAs are dropped (Postgres MVCC handles this).
- Add indexes for the hot lookups: `guild_id` on every guild-scoped
  table, `(guild_id, user_id)` unique pairs, `status` on tickets/tryouts.

## Runtime switch

Add one env var (never a hardcoded URL):

```bash
# Postgres preferred; falls back to SQLite when unset (local dev, tests)
DATABASE_URL=postgres://user:pass@host:5432/fgx
```

`src/database/index.js` chooses the adapter on `DATABASE_URL`, and
migrations run against whichever engine is active. Tests keep using the
SQLite path (`:memory:`) so CI needs no database service.

## Render (free tier) — persistence for free

Render's free plan has no persistent disks, but **free PostgreSQL is a
separate service** that survives app redeploys — this fixes the
ephemeral-DB problem permanently:

1. Render dashboard → **New → PostgreSQL** (free plan, 1 GB).
2. Copy the **Internal Database URL** into the FGx service's
   **Environment** tab as `DATABASE_URL`.
3. Redeploy. FGx detects `DATABASE_URL`, runs the Postgres migrations,
   and every future deploy keeps its data.

Caveat: Render's new free databases expire after ~90 days; migrate the
data (or upgrade) before then.

## Acceptance criteria

- [ ] `npm test` green on SQLite (`:memory:`), unchanged.
- [ ] `npm run validate` green.
- [ ] With `DATABASE_URL` set, the bot boots, applies all migrations,
      and `GET /health` reports `"database": "ok"`.
- [ ] Smoke: `/setup`, a `/warn`, a `/match result`, a ticket open/close —
      all persist across a redeploy.
- [ ] No secret is ever in the connection string in code; only the env var.
