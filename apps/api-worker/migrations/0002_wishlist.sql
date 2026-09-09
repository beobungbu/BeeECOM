PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS wishlists (
  customer_id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wishlists_updated_at ON wishlists(updated_at DESC);
