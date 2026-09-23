-- שעון הרצפה: מאיפה יודעים כמה זמן רכב עומד.
--
-- עד כאן היה רק opened_at, כלומר "מתי הרכב נכנס למוסך". זה לא עונה על השאלה
-- שדניאל שואל בפועל: כמה זמן הרכב הזה תופס את הליפט, וכמה זמן הוא תקוע
-- במצב שלו. שתי העמודות כאן נכתבות על ידי המסד ולא על ידי המסך, כדי שגם
-- עדכון שנעשה מפונקציה (send_finding) או מסקריפט יעדכן את השעון.

alter table public.job_cards
  add column if not exists lift_since timestamptz,
  add column if not exists status_since timestamptz not null default now();

-- לרכבים שכבר קיימים אין היסטוריה אמיתית, ולכן מתחילים מהזמן הכי קרוב שיש.
update public.job_cards set lift_since = opened_at where lift is not null and lift_since is null;
update public.job_cards set status_since = coalesce(ready_at, delivered_at, opened_at);

create or replace function public.job_cards_mark_clocks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.lift_since := case when new.lift is null then null else now() end;
    new.status_since := now();
  else
    -- רכב שיורד מהליפט מאבד את השעון, כדי שלא נציג זמן של עמדה שהוא כבר לא בה.
    if new.lift is distinct from old.lift then
      new.lift_since := case when new.lift is null then null else now() end;
    end if;
    if new.status is distinct from old.status then
      new.status_since := now();
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists job_cards_clocks on public.job_cards;
create trigger job_cards_clocks
  before insert or update on public.job_cards
  for each row execute function public.job_cards_mark_clocks();
