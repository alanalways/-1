/**
 * OAuth 認證回調頁面
 * 處理 Supabase Google OAuth 回調
 */

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const origin = requestUrl.origin;

    console.log('[Auth Callback] 收到回調，code:', code ? '存在' : '無');
    console.log('[Auth Callback] Origin:', origin);

    if (code) {
        // Supabase 會自動處理 code exchange
        // 我們只需重定向到首頁即可
        // Session 會自動透過 cookie 設定
    }

    // 登入成功後重定向到首頁
    return NextResponse.redirect(`${origin}/`);
}
