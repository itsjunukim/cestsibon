-- Tickets Table
create table if not exists tickets (
  id uuid default gen_random_uuid() primary key,
  name text not null, -- 종일권, 오전권, 오후권
  price numeric not null,
  created_at timestamptz default now()
);

-- Enable RLS for tickets
alter table tickets enable row level security;
create policy "Enable all access for anon" on tickets for all using (true) with check (true);

-- Update Reservations Table
alter table reservations add column if not exists reservation_type text check (reservation_type in ('accommodation', 'day')); -- 숙박, 당일
alter table reservations add column if not exists headcount integer;
alter table reservations add column if not exists ticket_id uuid references tickets(id) on delete set null;
alter table reservations add column if not exists deposit numeric default 0;
alter table reservations add column if not exists pickup_location text;
alter table reservations add column if not exists pickup_time text;
alter table reservations add column if not exists total_amount numeric default 0; -- 결재금액
alter table reservations add column if not exists balance numeric generated always as (total_amount - deposit) stored; -- 차액 (Auto-calculated if supported, or manual)

-- Postgres 12+ supports generated columns. If not, we'll just make it a normal column and handle in app.
-- For safety in older postgres or simple setup, let's make it a normal column.
alter table reservations drop column if exists balance;
alter table reservations add column if not exists balance numeric default 0;
