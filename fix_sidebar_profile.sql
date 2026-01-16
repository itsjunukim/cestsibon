-- Enable RLS on profiles if not already enabled
alter table public.profiles enable row level security;

-- Drop potentially conflicting policies
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;

-- Create policy to allow users to view their own profile
create policy "Users can view own profile" 
on public.profiles for select 
using ( auth.uid() = id );

-- Grant access to authenticated users
grant select on table public.profiles to authenticated;
