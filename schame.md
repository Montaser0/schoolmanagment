-- =========================================================
-- SCHOOL MANAGER SAAS - FINAL DATABASE SCHEMA
-- Multi-tenant + RLS + Attendance + Financial Views
-- =========================================================

create extension if not exists "pgcrypto";

-- =========================================================
-- 1) ENUMS
-- =========================================================
do $$ begin
  create type public.user_role as enum ('owner', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_type as enum ('trial', 'basic', 'pro', 'enterprise');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gender_type as enum ('male', 'female');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_status as enum ('active', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'absent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.expense_type as enum ('salary', 'general');
exception when duplicate_object then null; end $$;

-- =========================================================
-- 2) TABLES
-- =========================================================

-- 1) المدارس
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  subscription_plan public.subscription_type not null default 'trial',
  created_at timestamptz not null default now()
);

-- 2) المستخدمين (Profiles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (id, school_id)
);

-- 3) الصفوف
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  stage text,
  description text,
  created_at timestamptz not null default now(),
  unique (id, school_id),
  unique (school_id, name)
);

-- 4) الطلاب
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  class_id uuid references public.classes(id) on delete set null,
  gender public.gender_type not null,
  base_tuition numeric(12,2) not null default 0 check (base_tuition >= 0),
  guardian_phone text,
  address text,
  status public.student_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (id, school_id)
);

-- 5) المعلمون
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text not null,
  phone text,
  salary numeric(12,2) not null default 0 check (salary >= 0),
  subject text,
  created_at timestamptz not null default now(),
  unique (id, school_id)
);

-- 6) الأقساط
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  total_amount numeric(12,2) not null check (total_amount > 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  unique (id, school_id)
);

-- 7) الدفعات
-- installment_id مضاف لربط الدفعة بقسط محدد
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, school_id)
);

-- 8) حضور الطلاب
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null, -- present / absent
  created_at timestamptz not null default now(),
  unique (school_id, student_id, attendance_date)
);

-- 9) حضور المعلمين
create table if not exists public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null, -- present / absent
  created_at timestamptz not null default now(),
  unique (school_id, teacher_id, attendance_date)
);

-- 10) المصاريف
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  type public.expense_type not null, -- salary / general
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (id, school_id)
);

-- =========================================================
-- 3) CROSS-TENANT SAFETY (STRICT SCHOOL CONSISTENCY)
-- =========================================================

-- class must belong to same school
alter table public.students
  add constraint students_class_school_fk
  foreign key (class_id, school_id)
  references public.classes(id, school_id)
  on delete set null;

-- student must belong to same school
alter table public.installments
  add constraint installments_student_school_fk
  foreign key (student_id, school_id)
  references public.students(id, school_id)
  on delete cascade;

alter table public.payments
  add constraint payments_student_school_fk
  foreign key (student_id, school_id)
  references public.students(id, school_id)
  on delete cascade;

alter table public.payments
  add constraint payments_installment_school_fk
  foreign key (installment_id, school_id)
  references public.installments(id, school_id)
  on delete set null;

alter table public.student_attendance
  add constraint student_attendance_student_school_fk
  foreign key (student_id, school_id)
  references public.students(id, school_id)
  on delete cascade;

alter table public.teacher_attendance
  add constraint teacher_attendance_teacher_school_fk
  foreign key (teacher_id, school_id)
  references public.teachers(id, school_id)
  on delete cascade;

-- =========================================================
-- 4) INDEXES (PERFORMANCE)
-- =========================================================
create index if not exists idx_profiles_school on public.profiles(school_id);
create index if not exists idx_students_school on public.students(school_id);
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_teachers_school on public.teachers(school_id);
create index if not exists idx_installments_school_due on public.installments(school_id, due_date);
create index if not exists idx_installments_student on public.installments(student_id);
create index if not exists idx_payments_school_date on public.payments(school_id, paid_at desc);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_st_att_school_date on public.student_attendance(school_id, attendance_date);
create index if not exists idx_tc_att_school_date on public.teacher_attendance(school_id, attendance_date);
create index if not exists idx_expenses_school_date on public.expenses(school_id, expense_date);

-- =========================================================
-- 5) HELPER FUNCTIONS (RLS)
-- =========================================================
create or replace function public.current_user_school_id()
returns uuid
language sql
stable
as $$
  select p.school_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() = 'owner', false);
$$;

-- =========================================================
-- 6) RLS
-- =========================================================
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.installments enable row level security;
alter table public.payments enable row level security;
alter table public.student_attendance enable row level security;
alter table public.teacher_attendance enable row level security;
alter table public.expenses enable row level security;

-- schools
drop policy if exists schools_select_policy on public.schools;
create policy schools_select_policy on public.schools
for select using (id = public.current_user_school_id());

drop policy if exists schools_insert_policy on public.schools;
create policy schools_insert_policy on public.schools
for insert with check (auth.uid() is not null and owner_id = auth.uid());

drop policy if exists schools_update_owner_policy on public.schools;
create policy schools_update_owner_policy on public.schools
for update using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- profiles
drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
for select using (school_id = public.current_user_school_id());

drop policy if exists profiles_update_self_policy on public.profiles;
create policy profiles_update_self_policy on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_owner_insert_policy on public.profiles;
create policy profiles_owner_insert_policy on public.profiles
for insert with check (
  public.is_owner() and school_id = public.current_user_school_id()
);

drop policy if exists profiles_owner_update_policy on public.profiles;
create policy profiles_owner_update_policy on public.profiles
for update using (
  public.is_owner() and school_id = public.current_user_school_id()
)
with check (
  public.is_owner() and school_id = public.current_user_school_id()
);

-- classes
drop policy if exists classes_all_tenant_policy on public.classes;
create policy classes_all_tenant_policy on public.classes
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- students
drop policy if exists students_all_tenant_policy on public.students;
create policy students_all_tenant_policy on public.students
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- teachers
drop policy if exists teachers_all_tenant_policy on public.teachers;
create policy teachers_all_tenant_policy on public.teachers
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- installments
drop policy if exists installments_all_tenant_policy on public.installments;
create policy installments_all_tenant_policy on public.installments
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- payments
drop policy if exists payments_all_tenant_policy on public.payments;
create policy payments_all_tenant_policy on public.payments
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- student attendance
drop policy if exists student_attendance_all_tenant_policy on public.student_attendance;
create policy student_attendance_all_tenant_policy on public.student_attendance
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- teacher attendance
drop policy if exists teacher_attendance_all_tenant_policy on public.teacher_attendance;
create policy teacher_attendance_all_tenant_policy on public.teacher_attendance
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- expenses
drop policy if exists expenses_all_tenant_policy on public.expenses;
create policy expenses_all_tenant_policy on public.expenses
for all using (school_id = public.current_user_school_id())
with check (school_id = public.current_user_school_id());

-- =========================================================
-- 7) ONBOARDING RPC (CREATE SCHOOL + OWNER PROFILE)
-- =========================================================
create or replace function public.create_school_for_owner(
  p_school_name text,
  p_plan public.subscription_type default 'trial'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_school_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile already exists for this user';
  end if;

  insert into public.schools (name, owner_id, subscription_plan)
  values (p_school_name, v_user_id, p_plan)
  returning id into v_school_id;

  insert into public.profiles (id, school_id, role)
  values (v_user_id, v_school_id, 'owner');

  return v_school_id;
end;
$$;

revoke all on function public.create_school_for_owner(text, public.subscription_type) from public;
grant execute on function public.create_school_for_owner(text, public.subscription_type) to authenticated;

-- =========================================================
-- 8) VIEWS (DYNAMIC LOGIC)
-- =========================================================

-- حالة الأقساط + المتبقي (لا يتم تخزينه)
create or replace view public.v_installment_status as
select
  i.id as installment_id,
  i.school_id,
  i.student_id,
  i.total_amount,
  i.due_date,
  coalesce(sum(p.amount), 0)::numeric(12,2) as total_paid,
  (i.total_amount - coalesce(sum(p.amount), 0))::numeric(12,2) as remaining,
  case
    when (i.total_amount - coalesce(sum(p.amount), 0)) <= 0 then 'paid_full'
    when coalesce(sum(p.amount), 0) > 0 and (i.total_amount - coalesce(sum(p.amount), 0)) > 0 then 'paid_partial'
    when coalesce(sum(p.amount), 0) = 0 and i.due_date < current_date then 'late'
    else 'unpaid'
  end as payment_status
from public.installments i
left join public.payments p
  on p.installment_id = i.id
 and p.school_id = i.school_id
group by i.id, i.school_id, i.student_id, i.total_amount, i.due_date;

-- قائمة الطلاب المتأخرين
create or replace view public.v_late_students as
select
  s.id as student_id,
  s.school_id,
  s.full_name,
  c.name as class_name,
  vis.installment_id,
  vis.due_date,
  vis.total_amount,
  vis.total_paid,
  vis.remaining
from public.v_installment_status vis
join public.students s
  on s.id = vis.student_id and s.school_id = vis.school_id
left join public.classes c
  on c.id = s.class_id and c.school_id = s.school_id
where vis.payment_status = 'late'
  and s.status = 'active';

-- ملخص الداشبورد المالي
create or replace view public.v_financial_summary as
select
  s.id as school_id,
  coalesce((
    select sum(p.amount) from public.payments p where p.school_id = s.id
  ), 0)::numeric(12,2) as total_income,
  coalesce((
    select sum(e.amount) from public.expenses e where e.school_id = s.id
  ), 0)::numeric(12,2) as total_expenses,
  (
    coalesce((select sum(p.amount) from public.payments p where p.school_id = s.id), 0)
    - coalesce((select sum(e.amount) from public.expenses e where e.school_id = s.id), 0)
  )::numeric(12,2) as net_profit
from public.schools s;