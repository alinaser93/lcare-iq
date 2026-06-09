-- ═══════════════════════════════════════════════════════════════
-- LCare IQ — إعداد قاعدة بيانات Supabase
-- شغّل هذا السكربت مرة واحدة: SQL Editor → New query → الصق → Run
-- ═══════════════════════════════════════════════════════════════

-- جدول يحفظ كل بيانات التطبيق في صف واحد مشترك (يتزامن بين كل الأجهزة)
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- تفعيل حماية الصفوف (Row Level Security)
alter table public.app_state enable row level security;

-- سياسات الوصول (التطبيق يستخدم المفتاح العام anon/publishable الآمن)
drop policy if exists "allow read app_state" on public.app_state;
create policy "allow read app_state" on public.app_state
  for select using (true);

drop policy if exists "allow insert app_state" on public.app_state;
create policy "allow insert app_state" on public.app_state
  for insert with check (true);

drop policy if exists "allow update app_state" on public.app_state;
create policy "allow update app_state" on public.app_state
  for update using (true) with check (true);

-- تفعيل المزامنة الحيّة (Realtime) — تجعل التغييرات تظهر فوراً على كل الأجهزة
alter publication supabase_realtime add table public.app_state;
