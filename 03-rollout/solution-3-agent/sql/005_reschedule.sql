-- פתרון 3: שינוי מועד ב-Cal.com לא משאיר את התור הישן בלוח.
--
-- כשלקוח משנה מועד, Cal.com יוצר תור חדש עם מזהה חדש, ושולח אותו כ-
-- BOOKING_RESCHEDULED. intake_booking רושמת אותו בסטטוס 'rescheduled' — אבל
-- התור הישן נשאר 'booked', ובלוח של דניאל הרכב מופיע פעמיים, ביומיים שונים.
--
-- הטריגר מבטל את התור הקודם: אותה לוחית, אותו טלפון, עוד לא עבר, ועוד לא
-- נפתח לו כרטיס. בכוונה בלי לגעת ב-intake_booking עצמה, שרצה מ-Make ועובדת.

create or replace function private.cancel_replaced_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := right(regexp_replace(coalesce(new.customer_phone, ''), '\D', '', 'g'), 9);
begin
  if length(v_phone) < 8 then
    return new;
  end if;

  update public.bookings o
     set status = 'cancelled'
   where o.id <> new.id
     and o.status in ('booked', 'rescheduled')
     and o.plate = new.plate
     and right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9) = v_phone
     and o.drop_off_at > now() - interval '12 hours'
     and o.created_at < new.created_at
     and not exists (select 1 from public.job_cards j where j.booking_id = o.id);

  return new;
end;
$$;

revoke all on function private.cancel_replaced_booking() from public, anon, authenticated;

drop trigger if exists bookings_replace_rescheduled on public.bookings;
create trigger bookings_replace_rescheduled
  after insert or update of status on public.bookings
  for each row
  when (new.status = 'rescheduled')
  execute function private.cancel_replaced_booking();
