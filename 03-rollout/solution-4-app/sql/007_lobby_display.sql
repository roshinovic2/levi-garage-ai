-- מסך חדר ההמתנה, כדלת צרה.
--
-- המסך הזה תלוי על קיר מול לקוחות, בלי התחברות, ולכן הוא לא נוגע בטבלאות.
-- אותו עיקרון כמו approval_view ו-fleet_view: פונקציה אחת שמחזירה בדיוק את
-- מה שמותר לזר לראות, ושום שדה מעבר לזה.
--
-- מה לא יוצא מכאן, בכוונה:
--   · שם הלקוח וטלפון — אף פעם.
--   · מספר רישוי מלא — רק שלוש ספרות אחרונות, כמו בדף האישור. מספיק כדי
--     לזהות את הרכב שלך, לא מספיק כדי לזהות אדם.
--   · מחירים, ממצאים, ו"ממתין לאישור הלקוח" — זה היה מכריז פומבית שאדם
--     מסוים התבקש לשלם ועוד לא אישר.
--   · זמנים — העיכוב שלנו לא מוצג לאדם שנפגע ממנו בלי הסבר.
--
-- לכן יש שני מצבים בלבד: בעבודה, או מוכן.

create table if not exists public.displays (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('lobby')),
  name text not null,
  token text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.displays enable row level security;

-- הצוות רואה אילו מסכים קיימים. ל-anon אין מדיניות בכלל, ולכן הדרך היחידה
-- להגיע למידע היא הפונקציה למטה.
drop policy if exists displays_staff_read on public.displays;
create policy displays_staff_read on public.displays
  for select to authenticated using (public.is_staff());

create or replace function public.lobby_view(p_token text)
returns table (
  plate_last3 text,
  vehicle text,
  state text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    right(j.plate, 3) as plate_last3,
    nullif(btrim(coalesce(j.vehicle_make, '') || ' ' || coalesce(j.vehicle_model, '')), '') as vehicle,
    case when j.status = 'ready' then 'ready' else 'working' end as state
  from public.job_cards j
  join public.displays d
    on d.token = p_token and d.active and d.kind = 'lobby'
  where j.status in ('open', 'in_progress', 'waiting_quote', 'waiting_approval', 'ready')
  -- מוכנים קודם, כי זו הבשורה. בתוך כל קבוצה לפי הספרות, כדי שהעין תסרוק
  -- בסדר קבוע ולא תצטרך לחפש מחדש בכל רענון.
  order by (j.status = 'ready') desc, right(j.plate, 3);
$$;

revoke all on function public.lobby_view(text) from public;
grant execute on function public.lobby_view(text) to anon, authenticated;

-- מסך אחד להדגמה. הטוקן נוצר במסד ולא נכתב בקוד.
insert into public.displays (kind, name, token)
select 'lobby', 'חדר ההמתנה', encode(extensions.gen_random_bytes(18), 'hex')
where not exists (select 1 from public.displays where kind = 'lobby');

-- מסך שלא מצליח להתחבר חייב להגיד את זה. בלי הפונקציה הזאת, טוקן שהוקלד
-- לא נכון ביום ההתקנה היה מציג "אין כרגע רכבים במוסך" — מסך ששקט ומשקר.
-- זה לא דולף כלום: מי שיש לו את הטוקן המדויק כבר מחזיק את המפתח.
create or replace function public.lobby_name(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select d.name from public.displays d
  where d.token = p_token and d.active and d.kind = 'lobby';
$$;

revoke all on function public.lobby_name(text) from public;
grant execute on function public.lobby_name(text) to anon, authenticated;
