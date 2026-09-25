-- פתרון 3: "מה המצב של הרכב שלי?" — הבוט יודע מי כותב, בלי שהאתר יראה מספר.
--
-- הבוט כבר שולח לאתר, בכל שאלה, מזהה אטום של השולח: 'wa-' ועוד 16 תווים
-- ראשונים של HMAC-SHA256 על המספר, עם GARAGE_BOT_TOKEN כמפתח. כאן המסד
-- מחשב את אותו מזהה על הטלפונים שבתורים ובכרטיסים, ומחזיר רק את הרכבים של
-- מי שכותב. **המספר לא עובר בשום שלב**: לא מהבוט לאתר, ולא מהמסד לאתר.
--
-- למה זה בטוח לענות על מצב הרכב: מספר השולח בוואטסאפ לא ניתן לזיוף. מי
-- שכותב מהמספר שרשום על התור הוא מי שקבע אותו.
--
-- "דלת צרה", כמו intake_booking: הפונקציה פתוחה ל-anon, אבל רק עם הטוקן
-- המשותף, שנשמר בסכמה פרטית שלא חשופה ב-API. בלי הטוקן — 42501.

create or replace function private.garage_client_id(p_phone text, p_key text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if d ~ '^0\d{8,9}$' then
    d := '972' || substr(d, 2);
  elsif d !~ '^972\d{8,9}$' then
    return null;
  end if;
  return 'wa-' || left(encode(extensions.hmac(d, p_key, 'sha256'), 'hex'), 16);
end;
$$;

revoke all on function private.garage_client_id(text, text) from public, anon, authenticated;

-- מעדכן את הטוקן המשותף. רק service_role: הסקריפט wire-garage מעביר אותו
-- מהקובץ המקומי, והוא לא מופיע בקוד, בריפו או בשיחה.
create or replace function public.set_garage_bot_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(length(p_token), 0) < 32 then
    raise exception 'token too short' using errcode = '22023';
  end if;
  insert into private.settings (key, value) values ('garage_bot_token', p_token)
  on conflict (key) do update set value = excluded.value;
end;
$$;

revoke all on function public.set_garage_bot_token(text) from public, anon, authenticated;
grant execute on function public.set_garage_bot_token(text) to service_role;

-- הרכבים של מי שכותב: כרטיס פעיל (או שנמסר ביממה האחרונה), ותור עתידי
-- שעוד לא נפתח לו כרטיס. לכל היותר שלושה. רק מה שצריך כדי לענות: שם פרטי,
-- רכב, שלוש ספרות מהלוחית, שלב, ומתי.
create or replace function public.garage_customer(p_secret text, p_client text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select value into v_key from private.settings where key = 'garage_bot_token';
  if v_key is null or p_secret is null or p_secret <> v_key then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_client is null or p_client !~ '^wa-[0-9a-f]{16}$' then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(x)
    from (
      select x
      from (
        select jsonb_build_object(
                 'kind', 'job',
                 'name', nullif(split_part(btrim(coalesce(j.customer_name, '')), ' ', 1), ''),
                 'car', nullif(concat_ws(' ', j.vehicle_make, j.vehicle_model), ''),
                 'plate_tail', right(regexp_replace(j.plate, '\D', '', 'g'), 3),
                 'status', j.status,
                 'since', j.status_since,
                 'ready_at', j.ready_at,
                 'eta', (select f.eta from public.findings f
                         where f.job_card_id = j.id and f.eta is not null and f.status in ('sent', 'approved')
                         order by f.created_at desc limit 1)
               ) as x,
               j.opened_at as at
        from public.job_cards j
        where (j.status not in ('delivered', 'cancelled') or j.delivered_at > now() - interval '1 day')
          and private.garage_client_id(j.customer_phone, v_key) = p_client
        union all
        select jsonb_build_object(
                 'kind', 'booking',
                 'name', nullif(split_part(btrim(coalesce(b.customer_name, '')), ' ', 1), ''),
                 'car', nullif(concat_ws(' ', b.vehicle_make, b.vehicle_model), ''),
                 'plate_tail', right(b.plate, 3),
                 'status', b.status,
                 'drop_off_at', b.drop_off_at
               ),
               b.drop_off_at
        from public.bookings b
        where b.status in ('booked', 'rescheduled')
          and b.drop_off_at > now() - interval '12 hours'
          and not exists (select 1 from public.job_cards j where j.booking_id = b.id)
          and private.garage_client_id(b.customer_phone, v_key) = p_client
      ) all_rows
      order by at desc
      limit 3
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.garage_customer(text, text) from public;
grant execute on function public.garage_customer(text, text) to anon, authenticated;
