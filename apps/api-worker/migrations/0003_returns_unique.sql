CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_customer_order
  ON returns(customer_id, order_id);
