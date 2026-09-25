-- פתרון 4 בוואטסאפ: הקישור לאישור התיקון יוצא ללקוח מהבוט, ולא מועתק ביד.
--
-- עד היום "המתווך" היה פתור במנגנון ולא בערוץ: הלקוח אישר בכתב, אבל דניאל
-- היה צריך להעתיק את הקישור ולשלוח אותו בעצמו. כאן זה סוג הודעה שני באותה
-- דלת של "הרכב מוכן" (010).
--
-- לכרטיס אחד יכולים להיות כמה ממצאים, וממצא שנשלח שוב מקבל קישור חדש (הישן
-- מת). לכן ההודעה מזוהה לפי הקישור עצמו: עמודת ref מחזיקה את הטוקן של
-- האישור, ולכל קישור יוצאת הודעה אחת. ל"הרכב מוכן" ref ריק, כמו קודם.

alter table public.customer_notices add column if not exists ref text not null default '';

alter table public.customer_notices drop constraint if exists customer_notices_kind_check;
alter table public.customer_notices add constraint customer_notices_kind_check
  check (kind in ('ready', 'quote'));

alter table public.customer_notices drop constraint if exists customer_notices_job_card_id_kind_key;
alter table public.customer_notices drop constraint if exists customer_notices_job_kind_ref_key;
alter table public.customer_notices add constraint customer_notices_job_kind_ref_key
  unique (job_card_id, kind, ref);

-- אותה פונקציה מ-010. השינוי היחיד: המנעול כולל גם את ref.
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

  insert into public.customer_notices (job_card_id, kind, ref, created_by)
  values (p_job_id, 'ready', '', (select auth.uid()))
  on conflict (job_card_id, kind, ref) do update
    set status = 'pending',
        reason = null,
        sent_at = null,
        created_at = now(),
        created_by = excluded.created_by
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

-- תופס את ההודעה על הקישור הנוכחי של ממצא.
--
-- רק מנהל עבודה או הבעלים, כמו send_finding עצמה: מי ששולח מחיר ללקוח.
-- מחזיר null כשאין מה לשלוח: הממצא לא נשלח, הלקוח כבר ענה, הקישור פג,
-- או שההודעה על הקישור הזה כבר יצאה.
create or replace function public.claim_quote_notice(p_finding_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_job public.job_cards%rowtype;
  v_token text;
  v_id bigint;
begin
  select s.role into v_role from public.staff s where s.id = (select auth.uid()) and s.active;
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'only a manager or the owner can send a price to a customer' using errcode = '42501';
  end if;

  select a.token into v_token
  from public.approvals a
  join public.findings f on f.id = a.finding_id
  where a.finding_id = p_finding_id
    and f.status = 'sent'
    and a.decision is null
    and a.expires_at > now();
  if v_token is null then
    return null;
  end if;

  select j.* into v_job
  from public.job_cards j
  join public.findings f on f.job_card_id = j.id
  where f.id = p_finding_id;

  insert into public.customer_notices (job_card_id, kind, ref, created_by)
  values (v_job.id, 'quote', v_token, (select auth.uid()))
  on conflict (job_card_id, kind, ref) do update
    set status = 'pending',
        reason = null,
        sent_at = null,
        created_at = now(),
        created_by = excluded.created_by
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
    'plate', v_job.plate,
    'token', v_token
  );
end;
$$;

revoke all on function public.claim_quote_notice(bigint) from public, anon;
grant execute on function public.claim_quote_notice(bigint) to authenticated;
