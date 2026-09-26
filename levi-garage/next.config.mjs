/** @type {import('next').NextConfig} */
const nextConfig = {
  // מזהה של הבנייה, שנכנס גם לקוד שבדפדפן וגם לשרת. מסך שפתוח ימים (הטלוויזיה
  // בסדנה, בחדר ההמתנה) משווה אותו מול השרת לפני כל רענון, ואם השרת הוחלף —
  // טוען את הדף מחדש, במקום לערבב קוד ישן עם תוכן חדש (שגיאת React #418).
  env: { APP_BUILD: String(Date.now()) },
}

export default nextConfig
