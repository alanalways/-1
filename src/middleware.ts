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

    // 從 cookies 取得 session tokens
    const accessToken = request.cookies.get('sb-access-token')?.value;
    const refreshToken = request.cookies.get('sb-refresh-token')?.value;

    // 沒有任何 token，重導向到登入頁面
    if (!accessToken && !refreshToken) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 建立 Supabase client 並設定 session
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false,
        },
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
    });

    // 實際驗證 token 有效性
    try {
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error || !user) {
            // Token 無效，清除並重導向到登入頁面
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('sb-access-token');
            response.cookies.delete('sb-refresh-token');
            return response;
        }
    } catch {
        // 驗證過程出錯，允許通過（避免阻擋正常使用者）
        console.warn('[Middleware] Token 驗證過程出錯，允許通過');
    }

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
