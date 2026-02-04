/**
 * API Keys 管理服務
 * 從 Supabase 安全讀取 API Keys（服務端專用）
 */

import { createClient } from '@supabase/supabase-js';

// 建立具有 service_role 權限的 Supabase Client（僅限服務端使用）
const getServiceClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.warn('[API Keys] 缺少 Supabase 服務端設定');
        return null;
    }

    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};

// 快取設定
let cachedKeys: { [service: string]: string[] } = {};
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 分鐘快取

/**
 * 從 Supabase 取得指定服務的 API Keys
 * @param service 服務名稱（例如：'gemini'）
 * @returns API Keys 陣列
 */
export async function getApiKeys(service: string): Promise<string[]> {
    // 檢查快取
    const now = Date.now();
    if (cachedKeys[service] && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log(`[API Keys] 使用快取的 ${service} keys (${cachedKeys[service].length} 組)`);
        return cachedKeys[service];
    }

    const supabase = getServiceClient();
    if (!supabase) {
        console.warn('[API Keys] 無法建立服務端 Supabase Client，使用環境變數備援');
        return getFallbackKeys(service);
    }

    try {
        const { data, error } = await supabase
            .from('api_keys')
            .select('api_key')
            .eq('service', service)
            .eq('is_active', true);

        if (error) {
            console.error('[API Keys] 查詢失敗:', error.message);
            return getFallbackKeys(service);
        }

        if (!data || data.length === 0) {
            console.warn(`[API Keys] 未找到 ${service} 的 keys，使用環境變數備援`);
            return getFallbackKeys(service);
        }

        // 更新快取
        cachedKeys[service] = data.map((row: { api_key: string }) => row.api_key);
        cacheTimestamp = now;

        console.log(`[API Keys] 從 Supabase 載入 ${service} keys 成功 (${cachedKeys[service].length} 組)`);
        return cachedKeys[service];

    } catch (err) {
        console.error('[API Keys] 發生錯誤:', err);
        return getFallbackKeys(service);
    }
}

/**
 * 備援：從環境變數取得 Keys（向下相容）
 */
function getFallbackKeys(service: string): string[] {
    if (service === 'gemini') {
        const envKey = process.env.GEMINI_API_KEY;
        if (envKey && envKey !== 'your_gemini_api_key') {
            // 支援逗號分隔的多個 key
            return envKey.split(',').map(k => k.trim()).filter(k => k.length > 0);
        }
    }

    console.warn(`[API Keys] 無法取得 ${service} 的 keys`);
    return [];
}

/**
 * 清除快取（當需要強制重新載入時使用）
 */
export function clearApiKeysCache() {
    cachedKeys = {};
    cacheTimestamp = 0;
    console.log('[API Keys] 快取已清除');
}

/**
 * 停用特定 API Key（當 key 失效時呼叫）
 * 注意：這會實際更新資料庫
 */
export async function deactivateApiKey(service: string, apiKey: string): Promise<boolean> {
    const supabase = getServiceClient();
    if (!supabase) {
        console.warn('[API Keys] 無法停用 key：缺少服務端連線');
        return false;
    }

    try {
        const { error } = await supabase
            .from('api_keys')
            .update({ is_active: false })
            .eq('service', service)
            .eq('api_key', apiKey);

        if (error) {
            console.error('[API Keys] 停用 key 失敗:', error.message);
            return false;
        }

        // 清除快取，下次會重新載入
        delete cachedKeys[service];
        console.log(`[API Keys] 已停用 ${service} 的一組 key`);
        return true;

    } catch (err) {
        console.error('[API Keys] 停用 key 時發生錯誤:', err);
        return false;
    }
}
