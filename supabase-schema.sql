-- =====================================================
-- EMJ Advertising Service - Supabase Database Schema
-- Run this ONCE in Supabase Dashboard > SQL Editor > New Query
-- Project: https://tbghfzwnjxhxcnwvmxut.supabase.co
-- =====================================================

-- 1. Employees table
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "employeeId" text unique not null,
  department text default 'General',
  role text default '',
  "isActive" boolean default true,
  "createdAt" timestamptz default now()
);

-- 2. Time entries table (time in / time out records)
create table if not exists "timeEntries" (
  id uuid primary key default gen_random_uuid(),
  "employeeName" text not null,
  department text default 'General',
  date text not null,
  "timeIn" text,
  "timeOut" text,
  status text default 'present',
  "totalHours" numeric default 0,
  information text default '-',
  reason text default '',
  "createdAt" timestamptz default now()
);
create index if not exists "timeEntries_date_idx" on "timeEntries" (date);
create index if not exists "timeEntries_employee_idx" on "timeEntries" ("employeeName");

-- 3. Breaks table (morning / lunch / evening)
create table if not exists breaks (
  id uuid primary key default gen_random_uuid(),
  "employeeName" text not null,
  department text default 'General',
  date text not null,
  "breakType" text not null,
  "startTime" text,
  "endTime" text,
  duration numeric default 0,
  "createdAt" timestamptz default now()
);
create index if not exists breaks_date_idx on breaks (date);

-- 4. Row Level Security: allow the web app (anon key) to read/write
alter table employees enable row level security;
alter table "timeEntries" enable row level security;
alter table breaks enable row level security;

drop policy if exists "Allow all for anon" on employees;
create policy "Allow all for anon" on employees for all to anon using (true) with check (true);

drop policy if exists "Allow all for anon" on "timeEntries";
create policy "Allow all for anon" on "timeEntries" for all to anon using (true) with check (true);

drop policy if exists "Allow all for anon" on breaks;
create policy "Allow all for anon" on breaks for all to anon using (true) with check (true);
