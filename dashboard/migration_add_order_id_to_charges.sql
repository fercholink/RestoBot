-- Add order_id to room_charges table
ALTER TABLE room_charges 
ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL;
