/**
 * 會員系統服務
 * 管理使用者訂閱等級和 AI 分析使用量
 */

import { supabase } from './supabase';

// 訂閱等級定義
export type SubscriptionTier = 'free' | 'pro' | 'premium';

export interface UserSubscription {
    tier: SubscriptionTier;
    dailyLimit: number;       // 每日 AI 分析次數限制
    usedToday: number;        // 今日已使用次數
    lastResetDate: string;    // 上次重置日期
}

// 各等級限制
export const TIER_LIMITS: Record<SubscriptionTier, number> = {
    free: 2,        // 免費版：每天 2 次
    pro: 20,        // Pro 版：每天 20 次
    premium: -1,    // Premium：無限制 (-1 表示無限)
};

export const TIER_NAMES: Record<SubscriptionTier, string> = {
    free: '免費版',
    pro: 'Pro',
    premium: 'Premium',
};

export const TIER_COLORS: Record<SubscriptionTier, string> = {
    free: '#6b7280',    // 灰色
    pro: '#3b82f6',     // 藍色
    premium: '#f59e0b', // 金色
};

/**
 * 取得使用者訂閱資訊
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
    // 空值檢查：避免未登入時發送無效請求
    if (!userId || userId.trim() === '') {
        return getGuestUsage();
    }

    // 先檢查 localStorage 快取
    const cached = getLocalUsage(userId);

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (data && !error) {
                const today = new Date().toISOString().split('T')[0];

                // 如果是新的一天，重置使用量
                if (data.last_reset_date !== today) {
                    await resetDailyUsage(userId);
                    const tier = (data.tier as SubscriptionTier) || 'free';
                    return {
                        tier,
                        dailyLimit: TIER_LIMITS[tier],
                        usedToday: 0,
                        lastResetDate: today,
                    };
                }

                const tier = (data.tier as SubscriptionTier) || 'free';
                return {
                    tier,
                    dailyLimit: TIER_LIMITS[tier],
                    usedToday: data.used_today || 0,
                    lastResetDate: data.last_reset_date,
                };
            }
        } catch (error) {
            console.warn('[Subscription] 使用本地儲存:', error);
        }
    }

    // 使用 localStorage 作為備用
    return cached;
}

/**
 * 從 localStorage 取得使用量（備用方案）
 */
function getLocalUsage(userId: string): UserSubscription {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `ai_usage_${userId}_${today}`;
    const tierKey = `subscription_tier_${userId}`;

    const usage = parseInt(localStorage.getItem(storageKey) || '0', 10);
    const tier = (localStorage.getItem(tierKey) as SubscriptionTier) || 'free';

    return {
        tier,
        dailyLimit: TIER_LIMITS[tier],
        usedToday: usage,
        lastResetDate: today,
    };
}

/**
 * 記錄一次 AI 分析使用
 */
export async function recordAnalysisUsage(userId: string): Promise<boolean> {
    const subscription = await getUserSubscription(userId);

    // 檢查是否超過限制
    if (subscription.dailyLimit !== -1 && subscription.usedToday >= subscription.dailyLimit) {
        return false; // 已達限制
    }

    const today = new Date().toISOString().split('T')[0];

    if (supabase) {
        try {
            const { error } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    tier: subscription.tier,
                    used_today: subscription.usedToday + 1,
                    last_reset_date: today,
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;
        } catch (error) {
            console.warn('[Subscription] 使用本地儲存:', error);
            // 使用 localStorage 備用
            const storageKey = `ai_usage_${userId}_${today}`;
            localStorage.setItem(storageKey, String(subscription.usedToday + 1));
        }
    } else {
        // 使用 localStorage
        const storageKey = `ai_usage_${userId}_${today}`;
        localStorage.setItem(storageKey, String(subscription.usedToday + 1));
    }

    return true;
}

/**
 * 重置每日使用量
 */
async function resetDailyUsage(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    if (supabase) {
        try {
            await supabase
                .from('user_subscriptions')
                .update({
                    used_today: 0,
                    last_reset_date: today,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);
        } catch (error) {
            console.error('[Subscription] 重置失敗:', error);
        }
    }
}

/**
 * 檢查是否可以使用 AI 分析
 */
export async function canUseAnalysis(userId: string): Promise<{
    canUse: boolean;
    remaining: number;
    tier: SubscriptionTier;
    message?: string;
}> {
    const subscription = await getUserSubscription(userId);

    // Premium 無限制
    if (subscription.dailyLimit === -1) {
        return {
            canUse: true,
            remaining: -1,
            tier: subscription.tier,
        };
    }

    const remaining = subscription.dailyLimit - subscription.usedToday;

    if (remaining <= 0) {
        return {
            canUse: false,
            remaining: 0,
            tier: subscription.tier,
            message: `今日 AI 分析次數已用完，請明天再試或升級至 Pro/Premium`,
        };
    }

    return {
        canUse: true,
        remaining,
        tier: subscription.tier,
    };
}

/**
 * 升級訂閱等級（模擬）
 */
export async function upgradeTier(userId: string, newTier: SubscriptionTier): Promise<boolean> {
    if (supabase) {
        try {
            const { error } = await supabase
                .from('user_subscriptions')
                .upsert({
                    user_id: userId,
                    tier: newTier,
                    used_today: 0,
                    last_reset_date: new Date().toISOString().split('T')[0],
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[Subscription] 升級失敗:', error);
        }
    }

    // 使用 localStorage 備用
    localStorage.setItem(`subscription_tier_${userId}`, newTier);
    return true;
}

/**
 * 取得未登入使用者的使用量（使用 IP 或裝置識別）
 */
export function getGuestUsage(): UserSubscription {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `ai_usage_guest_${today}`;

    const usage = parseInt(localStorage.getItem(storageKey) || '0', 10);

    return {
        tier: 'free',
        dailyLimit: TIER_LIMITS.free,
        usedToday: usage,
        lastResetDate: today,
    };
}

/**
 * 記錄未登入使用者的使用量
 */
export function recordGuestUsage(): boolean {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `ai_usage_guest_${today}`;

    const usage = parseInt(localStorage.getItem(storageKey) || '0', 10);

    if (usage >= TIER_LIMITS.free) {
        return false; // 已達限制
    }

    localStorage.setItem(storageKey, String(usage + 1));
    return true;
}
