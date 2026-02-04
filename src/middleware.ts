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

    // ============================================================
    // 🔧 暫時停用 Middleware Auth 檢查
    // 
    // 原因：
    // 1. Supabase 在瀏覽器端使用 localStorage 存 session
    // 2. Middleware 在 Edge Runtime 執行，無法讀取 localStorage
    // 3. Cookie 名稱和格式與舊版不同
    // 4. OAuth callback 後 session 建立有延遲
    // 
    // 解決方案：改在前端頁面處理 auth redirect
    // ============================================================

    // 只做 log，不阻擋（未來可改用 Supabase SSR helper）
    console.log(`[Middleware] 路徑: ${pathname} - 放行`);

    return NextResponse.next();

    // ============ 以下為舊的驗證邏輯（保留供參考）============
    /*
    // 檢查 Supabase 環境變數
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('[Middleware] Supabase 未設定，跳過認證檢查');
        return NextResponse.next();
    }

    // 從 cookies 取得 session tokens
    // 注意：Supabase 的 cookie 名稱格式是 sb-<project-ref>-auth-token
    const cookies = request.cookies.getAll();
    const authCookie = cookies.find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

    if (!authCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }
    */
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
