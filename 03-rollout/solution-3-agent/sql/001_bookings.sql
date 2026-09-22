-- פתרון 3: טבלת התורים של מוסך לוי ובניו
-- כל תור שנקבע ב-Cal.com מגיע דרך Make, מועשר בפרטי הרכב ממאגר משרד התחבורה ונשמר כאן.
-- זו "האמת האחת" של היומן: הבוט (פתרון 3) וכרטיס העבודה (פתרון 4) קוראים ממנה.

create table if not exists public.bookings (
  id               bigint generated always as identity primary key,
  cal_uid          text unique not null,          -- מזהה התור ב-Cal.com (מונע כפילויות)
  status           text not null default 'booked'
                   check (status in ('booked', 'cancelled', 'rescheduled', 'arrived', 'in_progress', 'ready', 'delivered')),
  drop_off_at      timestamptz not null,          -- מועד מסירת הרכב

  -- הלקוח (מידע אישי: גישה רק לצד השרת, ראו RLS למטה)
  customer_name    text,
  customer_phone   text,
  whatsapp_consent boolean not null default false, -- בלי הסכמה, הבוט לא שולח וואטסאפ

  -- מה הלקוח ביקש
  plate            text not null,                 -- ספרות בלבד, בלי מקפים
  service          text,
  notes            text,

  -- מה נשלף אוטומטית ממאגר משרד התחבורה (data.gov.il)
  vehicle_found    boolean not null default false,
  vehicle_make     text,
  vehicle_model    text,
  vehicle_year     int,
  engine_code      text,
  fuel             text,
  tires            text,
  test_valid_until date,                          -- תוקף הטסט: הזדמנות לתזכורת ללקוח

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bookings_drop_off_idx on public.bookings (drop_off_at);
create index if not exists bookings_plate_idx on public.bookings (plate);

-- אבטחה: RLS פעיל ואין אף מדיניות לציבור.
-- מפתח ה-publishable (שנמצא בדפדפן) לא יכול לקרוא או לכתוב כלום.
-- רק צד השרת (Make, והאפליקציה עם secret key) ניגש לטבלה.
alter table public.bookings enable row level security;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
