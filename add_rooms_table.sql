create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  accommodation_id uuid references accommodations(id) on delete cascade,
  name text not null, -- e.g. "2인실"
  description text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table rooms enable row level security;
create policy "Enable all access for anon" on rooms for all using (true) with check (true);
