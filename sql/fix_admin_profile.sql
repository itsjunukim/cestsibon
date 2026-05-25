-- Ensure admin profile exists and has admin role
insert into public.profiles (id, email, role)
select id, email, 'admin'
from auth.users
where email = 'admin@cestsibon.com'
on conflict (id) do update
set role = 'admin';

-- Verify the result (optional, for your own sanity check using SQL editor)
select * from public.profiles where email = 'admin@cestsibon.com';
