import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session");
  const { pathname } = request.nextUrl;

  // 공개 페이지 & API
  const publicPaths = ["/", "/super-admin", "/api/auth/login", "/api/auth/logout"];
  if (publicPaths.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  // 최고관리자 페이지 & API는 별도 처리
  if (pathname.startsWith("/super-admin/") || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  // 인증 필요 페이지
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 관리자 페이지 권한 체크
  if (pathname.startsWith("/admin")) {
    try {
      const sessionData = JSON.parse(session.value);
      if (sessionData.user.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
