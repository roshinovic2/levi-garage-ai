-- מסכים בלי טוקנים.
--
-- קובץ 007 נתן למסך חדר ההמתנה קישור סודי, וזה גרר אחריו שובל שלם: טבלה,
-- הנפקת קישור, ביטול, ומסך ניהול. כל זה כדי להחליף דבר אחד שדניאל כבר יודע
-- לעשות — להתחבר. לכן הטוקנים יורדים, ובמקומם שתי כתובות קבועות:
--   /lobby — המסך בחדר ההמתנה
--   /wall  — הטלוויזיה בסדנה
--
-- למה לא פשוט המשתמש של דניאל בשני המסכים: המסך בחדר ההמתנה נשאר מחובר
-- כל היום בחדר ציבורי. מי שייגע בו היה מגיע ללוח היום, לשמות, לטלפונים
-- ולמחירים. לכן נוסף תפקיד 'display' — זהות שיודעת לפתוח מסך אחד ותו לא.

drop function if exists public.lobby_view(text);
drop function if exists public.lobby_name(text);
drop table if exists public.displays;

alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check
  check (role in ('owner', 'manager', 'mechanic', 'display'));

alter table public.staff add column if not exists screen text
  check (screen in ('lobby', 'wall'));

comment on column public.staff.screen is 'למשתמש מסך: איזה מסך הוא רשאי לפתוch. ריק לכל שאר התפקידים.';

-- הדלת לטבלאות העבודה. משתמש של חדר ההמתנה אינו איש צוות לצורך הזה: הוא
-- לא קורא job_cards, לא bookings ולא findings, גם לא מכלי הפיתוח של הדפדפן.
-- כל מה שהוא רואה מגיע מ-lobby_view, שמחזירה שלוש ספרות ודגם.
-- משתמש הסדנה כן נחשב, כי הטלוויזיה שלו תלויה באזור העבודה וממילא מציגה
-- לוחיות מלאות.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.id = (select auth.uid())
      and s.active
      and (s.role <> 'display' or s.screen = 'wall')
  )
$$;

-- אותו סינון כמו קודם, בלי הטוקן: הזהות המחוברת היא מה שפותח את הדלת.
create or replace function public.lobby_view()
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
  where j.status in ('open', 'in_progress', 'waiting_quote', 'waiting_approval', 'ready')
    and exists (
      select 1 from public.staff s
      where s.id = (select auth.uid())
        and s.active
        and (s.role <> 'display' or s.screen = 'lobby')
    )
  order by (j.status = 'ready') desc, right(j.plate, 3);
$$;

revoke all on function public.lobby_view() from public;
-- ל-anon אין יותר גישה בכלל: אין טוקן, ולכן אין למי לתת אותה.
grant execute on function public.lobby_view() to authenticated;
