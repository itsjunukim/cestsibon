-- 1. Create tickets table if it doesn't exist
CREATE TABLE IF NOT EXISTS tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS and set policies for tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policy to avoid errors if re-running
DROP POLICY IF EXISTS "Enable all access for anon" ON tickets;

-- Create full access policy
CREATE POLICY "Enable all access for anon" ON tickets FOR ALL USING (true) WITH CHECK (true);

-- 3. Add new columns to reservations table
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reservation_type TEXT CHECK (reservation_type IN ('accommodation', 'day'));
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS headcount INTEGER;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS pickup_location TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS pickup_time TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Ensure RLS policies exist for other tables (Optional safety check)
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON reservations;
CREATE POLICY "Enable all access for anon" ON reservations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for anon" ON sales;
CREATE POLICY "Enable all access for anon" ON sales FOR ALL USING (true) WITH CHECK (true);

-- 5. Insert initial ticket types if table is empty
INSERT INTO tickets (name, price)
SELECT '종일권', 80000
WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE name = '종일권');

INSERT INTO tickets (name, price)
SELECT '오전권', 50000
WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE name = '오전권');

INSERT INTO tickets (name, price)
SELECT '오후권', 50000
WHERE NOT EXISTS (SELECT 1 FROM tickets WHERE name = '오후권');
