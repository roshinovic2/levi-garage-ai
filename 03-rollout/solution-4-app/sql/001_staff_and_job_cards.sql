-- פתרון 4, שלב א': מי הצוות, מה על הליפט, ומה נמצא ברכב.
--
-- העיקרון שמנחה את הסכימה: הרכב מגיע מהכרטיס ולא מהקול (ממצא 2 ב-poc-voice/results.md),
-- ואף מחיר לא יוצא ללקוח בלי שאדם אישר אותו (ממצא 1 שם). לכן:
--   job_cards  = הרכב שעל הליפט, נפתח מתוך התור שכבר קיים ב-bookings
--   findings   = מה שהמכונאי מצא, כולל התמלול והמחירים. נולד כטיוטה
--   approvals  = האישור בכתב של הלקוח. שורה אחת לכל ממצא שנשלח
--
-- RLS: אף טבלה כאן לא נגישה מהדפדפן בלי התחברות. הלקוח לא מתחבר בכלל,
-- ולכן דף האישור שלו עובר דרך RPC ייעודי (קובץ 002) ולא דרך הטבלאות.

-- ---------- הצוות ----------
create table if not exists public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('owner', 'manager', 'mechanic')),
  lift smallint check (lift between 1 and 4),   -- לאיזה ליפט המכונאי משויך היום
  lang text not null default 'he' check (lang in ('he', 'ar', 'ru')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.staff is 'עובדי המוסך. השורה נוצרת ידנית אחרי שנוצר משתמש ב-auth.';
comment on column public.staff.lift is 'הליפט שעליו המכונאי עובד. ככה הודעה קולית משויכת לרכב הנכון.';

-- מי אני, לשימוש חוזר במדיניות ההרשאות. security definer כדי לא ליפול ל-RLS רקורסיבי.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s where s.id = (select auth.uid()) and s.active
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.id = (select auth.uid()) and s.active)
$$;

-- ---------- כרטיס העבודה ----------
create table if not exists public.job_cards (
  id bigint generated always as identity primary key,
  booking_id bigint references public.bookings (id) on delete set null,
  plate text not null,
  -- צילום מצב של הרכב ברגע הפתיחה. נשמר בכרטיס כדי שההיסטוריה לא תשתנה
  -- אם המאגר הממשלתי יתעדכן מחר.
  vehicle_make text,
  vehicle_model text,
  vehicle_year int,
  engine_code text,
  fuel text,
  customer_name text,
  customer_phone text,
  whatsapp_consent boolean not null default false,
  lift smallint check (lift between 1 and 4),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_approval', 'ready', 'delivered', 'cancelled')),
  opened_by uuid references public.staff (id),
  opened_at timestamptz not null default now(),
  ready_at timestamptz,
  delivered_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists job_cards_status_idx on public.job_cards (status, opened_at desc);
create index if not exists job_cards_plate_idx on public.job_cards (plate);
create unique index if not exists job_cards_booking_uniq on public.job_cards (booking_id) where booking_id is not null;

create trigger job_cards_touch
  before update on public.job_cards
  for each row execute function public.touch_updated_at();

-- ---------- מה נמצא ברכב ----------
create table if not exists public.findings (
  id bigint generated always as identity primary key,
  job_card_id bigint not null references public.job_cards (id) on delete cascade,
  source text not null default 'voice' check (source in ('voice', 'manual')),
  transcript text,                 -- מה שנאמר, כלשונו
  summary text,                    -- מה שהמודל הבין, לעיני הצוות
  customer_text text,              -- הטיוטה שתישלח ללקוח. אדם עורך ומאשר אותה
  price_original numeric(10, 2),   -- חלק מקורי, כולל מע"מ
  price_aftermarket numeric(10, 2),-- חלק חלופי, כולל מע"מ
  eta text,                        -- מתי הרכב יהיה מוכן אם מאשרים עכשיו
  red_list boolean not null default false,
  model text,                      -- איזה מודל ניסח, לתיעוד
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'declined', 'cancelled')),
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  sent_by uuid references public.staff (id),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists findings_job_idx on public.findings (job_card_id, created_at desc);
create index if not exists findings_status_idx on public.findings (status) where status in ('draft', 'sent');

create trigger findings_touch
  before update on public.findings
  for each row execute function public.touch_updated_at();

comment on column public.findings.customer_text is 'הטיוטה ללקוח. נוצרת במודל, נערכת ומאושרת על ידי אדם לפני שליחה.';

-- ---------- האישור בכתב ----------
create table if not exists public.approvals (
  id bigint generated always as identity primary key,
  finding_id bigint not null unique references public.findings (id) on delete cascade,
  token text not null unique,          -- הקישור שנשלח ללקוח. אקראי, חד פעמי
  channel text not null default 'link' check (channel in ('link', 'whatsapp')),
  message_text text not null,          -- מה בדיוק נשלח, מילה במילה
  price_chosen numeric(10, 2),         -- מה הלקוח אישר בפועל
  part_choice text check (part_choice in ('original', 'aftermarket')),
  decision text check (decision in ('approved', 'declined')),
  sent_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists approvals_token_idx on public.approvals (token);

comment on table public.approvals is 'האישור בכתב של הלקוח: מה נשלח, מה נבחר, ומתי. זה מה שמונע ויכוח בקופה.';

-- ---------- קבצים: הקלטה ותמונות ----------
create table if not exists public.media (
  id bigint generated always as identity primary key,
  job_card_id bigint not null references public.job_cards (id) on delete cascade,
  finding_id bigint references public.findings (id) on delete set null,
  kind text not null check (kind in ('audio', 'photo')),
  storage_path text not null,
  mime text,
  bytes int,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now()
);

create index if not exists media_job_idx on public.media (job_card_id, created_at desc);

-- ---------- הרשאות ----------
alter table public.staff enable row level security;
alter table public.job_cards enable row level security;
alter table public.findings enable row level security;
alter table public.approvals enable row level security;
alter table public.media enable row level security;

-- הצוות רואה את עצמו; בעלים ומנהל עבודה רואים את כולם.
create policy staff_self_read on public.staff
  for select to authenticated
  using (id = (select auth.uid()) or public.my_role() in ('owner', 'manager'));

-- כרטיסים, ממצאים וקבצים: כל אנשי הצוות הפעילים קוראים וכותבים.
-- ההפרדה בין מכונאי למנהל היא על פעולות רגישות (שליחה ללקוח), ונאכפת בקובץ 002.
create policy job_cards_staff_read on public.job_cards
  for select to authenticated using (public.is_staff());
create policy job_cards_staff_write on public.job_cards
  for insert to authenticated with check (public.is_staff());
create policy job_cards_staff_update on public.job_cards
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy findings_staff_read on public.findings
  for select to authenticated using (public.is_staff());
create policy findings_staff_write on public.findings
  for insert to authenticated with check (public.is_staff());
create policy findings_staff_update on public.findings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

create policy media_staff_read on public.media
  for select to authenticated using (public.is_staff());
create policy media_staff_write on public.media
  for insert to authenticated with check (public.is_staff());

-- אישורים: הצוות רואה, אבל אף אחד לא כותב ישירות. היצירה וההכרעה עוברות
-- דרך הפונקציות בקובץ 002, כדי שהטוקן של הלקוח לא ייחשף ולא ייכתב מהדפדפן.
create policy approvals_staff_read on public.approvals
  for select to authenticated using (public.is_staff());

-- הטבלה הקיימת של התורים נפתחת לקריאה לצוות בלבד (עד היום היא הייתה סגורה לחלוטין).
create policy bookings_staff_read on public.bookings
  for select to authenticated using (public.is_staff());
create policy bookings_staff_update on public.bookings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
