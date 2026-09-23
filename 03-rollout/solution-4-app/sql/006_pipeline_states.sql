-- שרשרת השלבים: רכב יושב בשלב אחד בלבד, ועובר הלאה בלחיצה.
--
-- עד כאן היה חסר שלב אחד, והוא דווקא זה שהכי תוקע: המכונאי סיים את הבדיקה
-- וצריך תשובה, אבל הכרטיס עדיין נראה "בעבודה" עד שדניאל שולח בפועל. זה
-- הסתיר את הזמן שבו הרכב תקוע אצלנו, לא אצל הלקוח.
--
-- 'waiting_quote' הוא השלב הזה: המכונאי סיים, הכדור אצל דניאל.
-- 'waiting_approval' נשאר מה שהיה: נשלח ללקוח, מחכים לו.

alter table public.job_cards drop constraint if exists job_cards_status_check;
alter table public.job_cards add constraint job_cards_status_check
  check (status in ('open', 'in_progress', 'waiting_quote', 'waiting_approval', 'ready', 'delivered', 'cancelled'));

-- send_finding ידעה לקדם רק כרטיס שהיה 'open' או 'in_progress'. בלי השורה
-- הזאת, כרטיס שהמכונאי סימן כמוכן לשליחה היה נתקע ב-waiting_quote גם אחרי
-- שדניאל שלח בפועל, והשעון היה ממשיך לספור את הצד הלא נכון.
create or replace function public.send_finding(
  p_finding_id bigint,
  p_message text,
  p_channel text default 'link'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_token text;
begin
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
     and status in ('open', 'in_progress', 'waiting_quote');

  return v_token;
end;
$$;

revoke all on function public.send_finding(bigint, text, text) from public;
grant execute on function public.send_finding(bigint, text, text) to authenticated;
