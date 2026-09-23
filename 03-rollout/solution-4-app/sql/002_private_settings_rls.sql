-- ממצא מה-advisor של Supabase: private.settings היא ללא RLS.
-- בפועל סכמת private לא חשופה ב-PostgREST (קריאה מהדפדפן מחזירה PGRST106),
-- ולכן זה לא ניתן לניצול. מפעילים בכל זאת, כדי שלא יישאר דגל אדום לפני ההגשה.
--
-- למה זה לא שובר את קליטת התורים: intake_booking היא security definer,
-- רצה בהרשאות הבעלים של הטבלה, ובעלים עוקף RLS אלא אם הופעל force.
-- לפני ההרצה: לוודא שקליטת תור עדיין עובדת (test/ ב-solution-3-agent).

alter table private.settings enable row level security;
