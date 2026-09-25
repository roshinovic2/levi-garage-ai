-- פתרון 3, שלב ג': הודעות שהמוסך יוזם ללקוח. הראשונה: "הרכב מוכן".
--
-- 25–35 שיחות "מתי מוכן" ביום הן קטגוריית השיחות הגדולה ביותר במוסך. הכרטיס
-- כבר יודע מתי הרכב מוכן; מה שחסר הוא שהלקוח יידע בלי להתקשר.
--
-- הטבלה הזאת היא היומן: לכל כרטיס, מה נשלח, מתי, ואם לא — למה. היא גם
-- המנעול: שורה אחת לכל כרטיס ולכל סוג הודעה, ולכן לחיצה כפולה על "מוכן",
-- או שני אנשים שלוחצים יחד, לא שולחים ללקוח פעמיים.
--
-- אין מדיניות כתיבה. כותבים רק דרך שתי הפונקציות למטה, והן בודקות בעצמן
-- את ההסכמה, את הטלפון ואת מצב הכרטיס.

create table if not exists public.customer_notices (
  id bigint generated always as identity primary key,
  job_card_id bigint not null references public.job_cards (id) on delete cascade,
  kind text not null check (kind in ('ready')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  -- למה לא נשלח: no_consent, no_phone, bad_phone, not_allowed, send_failed, unreachable
  reason text,
  created_by uuid references public.staff (id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (job_card_id, kind)
);

alter table public.customer_notices enable row level security;

drop policy if exists customer_notices_workers_read on public.customer_notices;
create policy customer_notices_workers_read on public.customer_notices
  for select to authenticated
  using (public.is_worker());

-- תופס את ההודעה לכרטיס, ומחזיר את מה שצריך כדי לשלוח אותה.
--
-- מחזיר null כשאין מה לעשות: הכרטיס לא במצב "מוכן", או שההודעה כבר נשלחה
-- או נמצאת בשליחה. הודעה שנכשלה נתפסת מחדש, וכך כפתור "לשלוח שוב" עובד.
--
-- בלי הסכמה לוואטסאפ, או בלי טלפון, השורה נרשמת כ-skipped עם הסיבה, כדי
-- שהצוות יראה בכרטיס שלא נשלח כלום ולמה — ולא יניח שהלקוח יודע.
create or replace function public.claim_ready_notice(p_job_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_cards%rowtype;
  v_id bigint;
begin
  if not public.is_worker() then
    raise exception 'only staff can notify a customer' using errcode = '42501';
  end if;

  select * into v_job from public.job_cards where id = p_job_id and status = 'ready';
  if not found then
    return null;
  end if;

  insert into public.customer_notices (job_card_id, kind, created_by)
  values (p_job_id, 'ready', (select auth.uid()))
  on conflict (job_card_id, kind) do update
    set status = 'pending',
        reason = null,
        sent_at = null,
        created_at = now(),
        created_by = excluded.created_by
    -- גם שליחה שנתקעה באמצע (השרת נפל בין התפיסה לתוצאה) משתחררת אחרי
    -- שתי דקות. אחרת הכרטיס היה נעול לתמיד על "בשליחה".
    where public.customer_notices.status = 'failed'
       or (public.customer_notices.status = 'pending'
           and public.customer_notices.created_at < now() - interval '2 minutes')
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  if not v_job.whatsapp_consent then
    update public.customer_notices set status = 'skipped', reason = 'no_consent' where id = v_id;
    return jsonb_build_object('id', v_id, 'send', false);
  end if;

  if coalesce(btrim(v_job.customer_phone), '') = '' then
    update public.customer_notices set status = 'skipped', reason = 'no_phone' where id = v_id;
    return jsonb_build_object('id', v_id, 'send', false);
  end if;

  return jsonb_build_object(
    'id', v_id,
    'send', true,
    'phone', v_job.customer_phone,
    'name', v_job.customer_name,
    'make', v_job.vehicle_make,
    'model', v_job.vehicle_model,
    'plate', v_job.plate
  );
end;
$$;

-- רושם איך זה נגמר. נוגע רק בשורה שעדיין בשליחה, כדי שתוצאה מאוחרת לא
-- תדרוס תוצאה של ניסיון חדש יותר.
create or replace function public.finish_notice(p_id bigint, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_worker() then
    raise exception 'only staff can notify a customer' using errcode = '42501';
  end if;

  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'unknown notice status' using errcode = '22023';
  end if;

  update public.customer_notices
     set status = p_status,
         reason = case when p_status = 'sent' then null else left(p_reason, 40) end,
         sent_at = case when p_status = 'sent' then now() else null end
   where id = p_id and status = 'pending';
end;
$$;

revoke all on function public.claim_ready_notice(bigint) from public, anon;
revoke all on function public.finish_notice(bigint, text, text) from public, anon;
grant execute on function public.claim_ready_notice(bigint) to authenticated;
grant execute on function public.finish_notice(bigint, text, text) to authenticated;
