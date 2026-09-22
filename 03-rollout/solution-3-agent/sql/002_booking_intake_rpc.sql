-- פתרון 3: "דלת צרה" לקליטת תורים מ-Make
-- Make לא מקבל מפתח ראשי למסד הנתונים. הוא יכול לעשות דבר אחד בלבד: לרשום או לעדכן תור,
-- ורק אם הוא שולח את הסיסמה הפנימית (intake_token), שנשמרת בסכמה פרטית שלא חשופה ב-API.
-- נבדק 22.9: סיסמה שגויה → 42501 unauthorized · קריאת bookings עם המפתח הציבורי → [] · סכמת private → לא חשופה.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

-- הסיסמה נוצרת אקראית בתוך המסד, ולא מופיעה בקוד או בריפו
insert into private.settings (key, value)
values ('intake_token', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create or replace function public.intake_booking(p_token text, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
  v_id bigint;
  v_event text := p->>'event';
begin
  select value into v_expected from private.settings where key = 'intake_token';
  if p_token is null or v_expected is null or p_token <> v_expected then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if v_event = 'BOOKING_CANCELLED' then
    update public.bookings set status = 'cancelled' where cal_uid = p->>'cal_uid'
    returning id into v_id;
    return jsonb_build_object('ok', v_id is not null, 'id', v_id, 'action', 'cancelled');
  end if;

  insert into public.bookings (
    cal_uid, status, drop_off_at, customer_name, customer_phone, whatsapp_consent,
    plate, service, notes, vehicle_found, vehicle_make, vehicle_model, vehicle_year,
    engine_code, fuel, tires, test_valid_until
  ) values (
    p->>'cal_uid',
    case when v_event = 'BOOKING_RESCHEDULED' then 'rescheduled' else 'booked' end,
    (p->>'drop_off_at')::timestamptz,
    nullif(p->>'customer_name', ''),
    nullif(p->>'customer_phone', ''),
    coalesce(nullif(p->>'whatsapp_consent', '')::boolean, false),
    regexp_replace(coalesce(p->>'plate', ''), '\D', '', 'g'),
    nullif(p->>'service', ''),
    nullif(p->>'notes', ''),
    coalesce(nullif(p->>'vehicle_found', '')::boolean, false),
    nullif(p->>'vehicle_make', ''),
    nullif(p->>'vehicle_model', ''),
    nullif(p->>'vehicle_year', '')::int,
    nullif(p->>'engine_code', ''),
    nullif(p->>'fuel', ''),
    nullif(p->>'tires', ''),
    nullif(p->>'test_valid_until', '')::date
  )
  on conflict (cal_uid) do update set
    status = excluded.status, drop_off_at = excluded.drop_off_at,
    customer_name = excluded.customer_name, customer_phone = excluded.customer_phone,
    whatsapp_consent = excluded.whatsapp_consent, plate = excluded.plate,
    service = excluded.service, notes = excluded.notes,
    vehicle_found = excluded.vehicle_found, vehicle_make = excluded.vehicle_make,
    vehicle_model = excluded.vehicle_model, vehicle_year = excluded.vehicle_year,
    engine_code = excluded.engine_code, fuel = excluded.fuel, tires = excluded.tires,
    test_valid_until = excluded.test_valid_until
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'action', 'upserted');
end $$;

revoke all on function public.intake_booking(text, jsonb) from public;
grant execute on function public.intake_booking(text, jsonb) to anon;
