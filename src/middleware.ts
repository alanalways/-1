/**
 * Next.js 中介軟體
 * 強制所有頁面需要登入（除了公開路由）
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 公開路由（不需要登入）
const publicRoutes = [
    '/login',
    '/auth/callback',
    '/api/auth',
];

// 靜態檔案路徑
const staticPaths = [
    '/_next',
    '/favicon.ico',
    '/public',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 跳過靜態檔案
    if (staticPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // 跳過公開路由
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // 檢查 Supabase 環境變數
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // Supabase 未設定，暫時允許訪問（開發模式）
        console.warn('[Middleware] Supabase 未設定，跳過認證檢查');
        return NextResponse.next();
    }

    // 從 cookies 取得 session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
    });

    // 嘗試從 cookies 取得 access token
    const accessToken = request.cookies.get('sb-access-token')?.value;
    const refreshToken = request.cookies.get('sb-refresh-token')?.value;

    if (!accessToken && !refreshToken) {
        // 沒有 token，重導向到登入頁面
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 驗證 session（可選，為了效能可以跳過）
    // 這裡我們信任 token 存在即代表已登入
    // 如果需要更嚴格的驗證，可以調用 supabase.auth.getUser()

    return NextResponse.next();
}

// 設定哪些路徑要執行中介軟體
export const config = {
    matcher: [
        /*
         * 匹配所有路徑，除了：
         * - api routes (/api/*)
         * - _next static files
         * - favicon.ico
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
