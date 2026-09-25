-- פתרון 3: תזכורת בוואטסאפ ביום שלפני התור.
--
-- עד עכשיו כל הודעה ללקוח הייתה קשורה לכרטיס עבודה. תזכורת נשלחת לפני
-- שיש כרטיס — הרכב עוד לא הגיע — ולכן היומן customer_notices מקבל גם
-- booking_id, ולפחות אחד מהשניים חייב להיות מלא.
--
-- מי מפעיל: משימה יומית באתר (Vercel Cron), וגם כפתור בלוח של דניאל. אין
-- משתמש מחובר במשימה, ולכן הפונקציות כאן הן "דלת צרה" עם הטוקן המשותף,
-- כמו garage_customer (003). מה שהן יכולות לעשות: לתפוס תזכורות של מחר
-- ולרשום איך נגמרו. לא יותר.

alter table public.customer_notices
  add column if not exists booking_id bigint references public.bookings (id) on delete cascade;

alter table public.customer_notices alter column job_card_id drop not null;

alter table public.customer_notices drop constraint if exists customer_notices_target_check;
alter table public.customer_notices add constraint customer_notices_target_check
  check (job_card_id is not null or booking_id is not null);

alter table public.customer_notices drop constraint if exists customer_notices_kind_check;
alter table public.customer_notices add constraint customer_notices_kind_check
  check (kind in ('ready', 'quote', 'reminder'));

-- תזכורת היא בלי כרטיס (job_card_id ריק). בלי "nulls not distinct", שתי
-- שורות עם job_card_id ריק לא היו מתנגשות, והמנעול היה פתוח.
alter table public.customer_notices drop constraint if exists customer_notices_job_kind_ref_key;
alter table public.customer_notices add constraint customer_notices_job_kind_ref_key
  unique nulls not distinct (job_card_id, kind, ref);

create index if not exists customer_notices_booking_idx on public.customer_notices (booking_id) where booking_id is not null;

create or replace function private.bot_secret_ok(p_secret text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_secret is not null
     and p_secret = (select value from private.settings where key = 'garage_bot_token')
$$;

revoke all on function private.bot_secret_ok(text) from public, anon, authenticated;

-- תופס את התזכורות של מחר (לפי שעון ישראל), ומחזיר מה צריך כדי לשלוח.
-- רק תור פעיל, עם הסכמה לוואטסאפ ועם טלפון. תזכורת שכבר נשלחה לא נתפסת
-- שוב; שנכשלה, או שנתקעה באמצע יותר משתי דקות, נתפסת מחדש.
create or replace function public.claim_due_reminders(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  b public.bookings%rowtype;
  v_id bigint;
begin
  if not private.bot_secret_ok(p_secret) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  for b in
    select * from public.bookings
    where status in ('booked', 'rescheduled')
      and whatsapp_consent
      and coalesce(btrim(customer_phone), '') <> ''
      and (drop_off_at at time zone 'Asia/Jerusalem')::date
          = (now() at time zone 'Asia/Jerusalem')::date + 1
    order by drop_off_at
  loop
    v_id := null;
    insert into public.customer_notices (booking_id, kind, ref)
    values (b.id, 'reminder', b.id::text)
    on conflict (job_card_id, kind, ref) do update
      set status = 'pending',
          reason = null,
          sent_at = null,
          created_at = now()
      where public.customer_notices.status = 'failed'
         or (public.customer_notices.status = 'pending'
             and public.customer_notices.created_at < now() - interval '2 minutes')
    returning id into v_id;

    if v_id is not null then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', v_id,
        'send', true,
        'phone', b.customer_phone,
        'name', b.customer_name,
        'make', b.vehicle_make,
        'model', b.vehicle_model,
        'plate', b.plate,
        'at', b.drop_off_at,
        'uid', b.cal_uid
      ));
    end if;
  end loop;

  return v_out;
end;
$$;

-- כמו finish_notice (010), למשימה שאין בה משתמש מחובר. נוגעת רק בתזכורות.
create or replace function public.finish_reminder(p_secret text, p_id bigint, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.bot_secret_ok(p_secret) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'unknown notice status' using errcode = '22023';
  end if;

  update public.customer_notices
     set status = p_status,
         reason = case when p_status = 'sent' then null else left(p_reason, 40) end,
         sent_at = case when p_status = 'sent' then now() else null end
   where id = p_id and kind = 'reminder' and status = 'pending';
end;
$$;

revoke all on function public.claim_due_reminders(text) from public;
revoke all on function public.finish_reminder(text, bigint, text, text) from public;
grant execute on function public.claim_due_reminders(text) to anon, authenticated;
grant execute on function public.finish_reminder(text, bigint, text, text) to anon, authenticated;
