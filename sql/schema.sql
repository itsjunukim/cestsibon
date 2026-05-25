-- Accommodations Table
create table if not exists accommodations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact text,
  details text,
  created_at timestamptz default now()
);

-- Reservations Table
create table if not exists reservations (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  phone text,
  date date not null,
  accommodation_id uuid references accommodations(id) on delete set null,
  status text not null default 'booked' check (status in ('booked', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz default now()
);

-- Sales Table
create table if not exists sales (
  id uuid default gen_random_uuid() primary key,
  reservation_id uuid references reservations(id) on delete set null,
  item_name text not null,
  amount numeric not null,
  category text not null check (category in ('ski', 'room', 'food', 'other')),
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) - Optional for now if simply using anon key with open policies, 
-- but better to set up basic policies. For this MVP, we might assume trusted users or enable public access.
-- For simplicity in this demo, we will enable RLS but allow anon access for now (or user can disable RLS).
alter table accommodations enable row level security;
alter table reservations enable row level security;
alter table sales enable row level security;

create policy "Enable all access for anon" on accommodations for all using (true) with check (true);
create policy "Enable all access for anon" on reservations for all using (true) with check (true);
create policy "Enable all access for anon" on sales for all using (true) with check (true);

INSERT INTO accommodations (name, details) VALUES ('길조호텔', 'Traditional Korean style business hotel');
