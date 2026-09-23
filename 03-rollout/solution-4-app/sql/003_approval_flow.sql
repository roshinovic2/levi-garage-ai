-- פתרון 4, שלב ב': מסלול האישור, כדלתות צרות.
--
-- שלוש פונקציות, וכל אחת עושה דבר אחד:
--   send_finding    - מנהל עבודה או בעלים שולח ממצא ללקוח. מייצר טוקן, נועל את הנוסח.
--   approval_view   - דף הלקוח קורא את מה שנשלח לו, לפי הטוקן בלבד. בלי התחברות.
--   approval_decide - הלקוח מאשר או דוחה. פעם אחת. אחרי זה נעול.
--
-- למה RPC ולא גישה ישירה לטבלאות: הלקוח לא מתחבר, ואין לו זהות. אם היינו פותחים
-- את approvals לקריאה ציבורית, מי שמנחש טוקן היה רואה גם את כל השאר. כאן כל קריאה
-- מחזירה רק את השורה של הטוקן שבידיו, ורק את השדות שהוא צריך לראות.

-- ---------- שליחה ללקוח ----------
create or replace function public.send_finding(
  p_finding_id bigint,
  p_message text,
  p_channel text default 'link'
)
returns text                       -- הטוקן, לבניית הקישור
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_token text;
begin
  -- רק מנהל עבודה או בעלים שולחים מחיר ללקוח. מכונאי מכין, אדם אחר מאשר.
  -- זו ההחלטה מממצא 1 ב-poc-voice/results.md, אכופה במסד ולא רק במסך.
  select s.role into v_role
  from public.staff s
  where s.id = (select auth.uid()) and s.active;

  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'only a manager or the owner can send a price to a customer'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_message), '') = '' then
    raise exception 'the message to the customer cannot be empty' using errcode = '22023';
  end if;

  if p_channel not in ('link', 'whatsapp') then
    raise exception 'unknown channel' using errcode = '22023';
  end if;

  v_token := encode(extensions.gen_random_bytes(18), 'hex');

  insert into public.approvals (finding_id, token, channel, message_text)
  values (p_finding_id, v_token, p_channel, btrim(p_message))
  on conflict (finding_id) do update
    set token = excluded.token,
        channel = excluded.channel,
        message_text = excluded.message_text,
        sent_at = now(),
        decision = null,
        decided_at = null,
        price_chosen = null,
        part_choice = null,
        expires_at = now() + interval '7 days';

  update public.findings
     set status = 'sent', sent_at = now(), sent_by = (select auth.uid())
   where id = p_finding_id;

  update public.job_cards
     set status = 'waiting_approval'
   where id = (select f.job_card_id from public.findings f where f.id = p_finding_id)
     and status in ('open', 'in_progress');

  return v_token;
end;
$$;

revoke all on function public.send_finding(bigint, text, text) from public;
grant execute on function public.send_finding(bigint, text, text) to authenticated;

-- ---------- מה הלקוח רואה ----------
create or replace function public.approval_view(p_token text)
returns table (
  message_text text,
  price_original numeric,
  price_aftermarket numeric,
  eta text,
  decision text,
  decided_at timestamptz,
  part_choice text,
  expired boolean,
  plate_last3 text,           -- שלוש ספרות אחרונות בלבד, כדי שהלקוח יזהה את הרכב
  vehicle text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.message_text,
    f.price_original,
    f.price_aftermarket,
    f.eta,
    a.decision,
    a.decided_at,
    a.part_choice,
    (now() > a.expires_at) as expired,
    right(j.plate, 3) as plate_last3,
    btrim(coalesce(j.vehicle_make, '') || ' ' || coalesce(j.vehicle_model, '')) as vehicle
  from public.approvals a
  join public.findings f on f.id = a.finding_id
  join public.job_cards j on j.id = f.job_card_id
  where a.token = p_token
$$;

revoke all on function public.approval_view(text) from public;
grant execute on function public.approval_view(text) to anon, authenticated;

-- ---------- ההכרעה של הלקוח ----------
create or replace function public.approval_decide(
  p_token text,
  p_decision text,
  p_part_choice text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_finding bigint;
  v_price numeric;
begin
  if p_decision not in ('approved', 'declined') then
    raise exception 'decision must be approved or declined' using errcode = '22023';
  end if;

  select a.id, a.finding_id into v_id, v_finding
  from public.approvals a
  where a.token = p_token
    and a.decision is null
    and now() <= a.expires_at
  for update;

  if v_id is null then
    -- טוקן לא קיים, כבר הוכרע, או פג. אותה תשובה לשלושתם, כדי לא לדלוף מידע.
    return 'unavailable';
  end if;

  if p_decision = 'approved' then
    if p_part_choice not in ('original', 'aftermarket') then
      raise exception 'choose an original or an aftermarket part' using errcode = '22023';
    end if;
    select case when p_part_choice = 'original' then f.price_original else f.price_aftermarket end
      into v_price
      from public.findings f where f.id = v_finding;
  end if;

  update public.approvals
     set decision = p_decision,
         decided_at = now(),
         part_choice = case when p_decision = 'approved' then p_part_choice end,
         price_chosen = v_price
   where id = v_id;

  update public.findings
     set status = case when p_decision = 'approved' then 'approved' else 'declined' end
   where id = v_finding;

  -- הרכב חוזר לעבודה אם אושר, ואם נדחה הוא ממשיך בלי התוספת. בשני המקרים
  -- הליפט לא ממתין יותר לתשובה.
  update public.job_cards
     set status = 'in_progress'
   where id = (select f.job_card_id from public.findings f where f.id = v_finding)
     and status = 'waiting_approval';

  return p_decision;
end;
$$;

revoke all on function public.approval_decide(text, text, text) from public;
grant execute on function public.approval_decide(text, text, text) to anon, authenticated;
