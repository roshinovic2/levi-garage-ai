-- פתרון 4, שלב ה': הציים וההיסטוריה.
--
-- רונית מוציאה היום 14 חשבונות צי מאקסל, קובץ לכל חברה, ומבלה על זה 2 עד 3 ימי
-- עבודה בחודש. החוב הפתוח עומד על ₪60 אלף ומעלה, והגבייה מגיעה אחרי 60 עד 70 יום.
-- הבסיס לכל תיקון של זה הוא אותו דבר: לדעת איזה רכב שייך לאיזו חברה, ומה נעשה בו.
--
-- מנהל הצי לא מתחבר. הוא מקבל קישור קבוע, בדיוק כמו שהלקוח הפרטי מקבל קישור
-- לאישור. זה מה שמאפשר "אתם עם חשבון אחד" בלי לנהל משתמשים וסיסמאות לחברות.

create table if not exists public.fleets (
  id bigint generated always as identity primary key,
  name text not null,
  contact_name text,
  contact_phone text,
  token text not null unique,      -- הקישור של מנהל הצי
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fleet_vehicles (
  id bigint generated always as identity primary key,
  fleet_id bigint not null references public.fleets (id) on delete cascade,
  plate text not null,
  nickname text,                   -- "המסחרית של אבי", כדי שמנהל הצי יזהה
  active boolean not null default true,
  added_at timestamptz not null default now(),
  unique (plate)                   -- רכב שייך לצי אחד בלבד
);

create index if not exists fleet_vehicles_fleet_idx on public.fleet_vehicles (fleet_id, active);

alter table public.fleets enable row level security;
alter table public.fleet_vehicles enable row level security;

create policy fleets_staff_read on public.fleets
  for select to authenticated using (public.is_staff());
create policy fleets_staff_write on public.fleets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy fleet_vehicles_staff_read on public.fleet_vehicles
  for select to authenticated using (public.is_staff());
create policy fleet_vehicles_staff_write on public.fleet_vehicles
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- היסטוריית רכב ----------
-- מה שהצוות רואה כשהוא מקליד מספר רישוי: כל ביקור, מה נמצא, ומה הלקוח אישר.
-- זו הסיבה שאפשר לומר ללקוח "היסטוריית טיפולים לכל רכב" ולא להמציא אותה בדיעבד.
create or replace view public.vehicle_history
with (security_invoker = true)
as
select
  j.plate,
  j.id as job_card_id,
  j.opened_at,
  j.delivered_at,
  j.status,
  j.vehicle_make,
  j.vehicle_model,
  j.vehicle_year,
  j.customer_name,
  count(f.id) filter (where f.id is not null) as findings,
  count(a.id) filter (where a.decision = 'approved') as approved,
  count(a.id) filter (where a.decision = 'declined') as declined,
  coalesce(sum(a.price_chosen) filter (where a.decision = 'approved'), 0) as approved_total
from public.job_cards j
left join public.findings f on f.job_card_id = j.id
left join public.approvals a on a.finding_id = f.id
group by j.id;

-- ---------- מה מנהל הצי רואה ----------
-- דלת צרה אחת, לפי הטוקן שבידיו. הוא רואה את הרכבים של החברה שלו בלבד,
-- בלי שמות של לקוחות אחרים ובלי טלפונים.
create or replace function public.fleet_view(p_token text)
returns table (
  fleet_name text,
  plate text,
  nickname text,
  vehicle text,
  last_visit timestamptz,
  status text,
  visits bigint,
  approved_total numeric,
  month_total numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select id, name from public.fleets where token = p_token and active
  ),
  cars as (
    select fv.plate, fv.nickname
    from public.fleet_vehicles fv
    join f on f.id = fv.fleet_id
    where fv.active
  )
  select
    (select name from f) as fleet_name,
    c.plate,
    c.nickname,
    (
      select btrim(coalesce(j.vehicle_make, '') || ' ' || coalesce(j.vehicle_model, ''))
      from public.job_cards j where j.plate = c.plate order by j.opened_at desc limit 1
    ) as vehicle,
    (select max(j.opened_at) from public.job_cards j where j.plate = c.plate) as last_visit,
    (select j.status from public.job_cards j where j.plate = c.plate order by j.opened_at desc limit 1) as status,
    (select count(*) from public.job_cards j where j.plate = c.plate) as visits,
    coalesce((
      select sum(a.price_chosen)
      from public.job_cards j
      join public.findings fi on fi.job_card_id = j.id
      join public.approvals a on a.finding_id = fi.id and a.decision = 'approved'
      where j.plate = c.plate
    ), 0) as approved_total,
    coalesce((
      select sum(a.price_chosen)
      from public.job_cards j
      join public.findings fi on fi.job_card_id = j.id
      join public.approvals a on a.finding_id = fi.id and a.decision = 'approved'
      where j.plate = c.plate and a.decided_at >= date_trunc('month', now())
    ), 0) as month_total
  from cars c
  where exists (select 1 from f)
  order by c.plate;
$$;

revoke all on function public.fleet_view(text) from public;
grant execute on function public.fleet_view(text) to anon, authenticated;
