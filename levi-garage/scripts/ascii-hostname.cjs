// עוקף באג ב-Vercel CLI במחשב ששמו בעברית.
//
// `vercel login` קורא לטוקן שהוא יוצר על שם המחשב (os.hostname()), ושולח
// את השם בכותרת HTTP. שם המחשב כאן הוא "אלון", וכותרות HTTP מקבלות רק
// תווים לטיניים, ולכן ההתחברות נופלת עוד לפני שהיא מתחילה:
//
//   TypeError: אלון @ vercel 54.1.0 ... is not a legal HTTP header value
//
// הקובץ הזה מחליף את השם רק בתוך התהליך שטוען אותו, ורק כשיש בו תווים
// שאינם ASCII. שם המחשב עצמו לא משתנה, ושום תוכנה אחרת לא מושפעת.
//
// שימוש, ב-PowerShell:
//   $env:NODE_OPTIONS = "--require C:\projects\final-project\levi-garage\scripts\ascii-hostname.cjs"
//   npx vercel login
//   Remove-Item Env:NODE_OPTIONS
//
// אחרי ההתחברות הוא לא נחוץ יותר: שאר הפקודות של Vercel לא שולחות את שם
// המחשב, והפריסות מהמחשב הזה עבדו לאורך כל הפרויקט.

const os = require("os")

const real = os.hostname()
if (/[^\x20-\x7e]/.test(real)) {
  os.hostname = () => "alon-pc"
}
