import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

// Next.js 16: proxy.ts replaces middleware.ts.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Skip static assets and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
