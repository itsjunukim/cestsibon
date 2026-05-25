-- Add name and phone columns to profiles table
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists phone text;
