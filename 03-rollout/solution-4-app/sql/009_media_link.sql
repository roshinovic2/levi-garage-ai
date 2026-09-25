-- הקישור בין הקלטה לטיוטה שנוצרה ממנה.
--
-- העמודה media.finding_id קיימת מקובץ 001, והקוד עדכן אותה מהיום הראשון —
-- אבל לטבלה היו רק מדיניות SELECT ומדיניות INSERT, ולכן כל עדכון נדחה
-- בשקט. PostgREST מחזיר 204 גם כשלא עודכנה אף שורה, ולכן שום דבר לא צעק.
--
-- אף אחד לא הרגיש, כי אף מסך לא הציג את הקישור. הוא התגלה ברגע שנבנה
-- המסך "הקלטות שלא תומללו": כל ההקלטות הופיעו שם, גם אלה שתומללו בהצלחה.
--
-- הלקח: עמודה שאף אחד לא קורא היא עמודה שאף אחד לא יודע ששבורה.

drop policy if exists media_staff_update on public.media;
create policy media_staff_update on public.media
  for update to authenticated
  using (public.is_worker()) with check (public.is_worker());
