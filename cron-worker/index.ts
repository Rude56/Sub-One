/// <reference types="@cloudflare/workers-types" />
/**
 * Sub-One Cron 触发器 (独立 Cloudflare Worker)
 * 
 * 每 24 小时自动调用 Sub-One Pages 的 /api/cron/trigger 接口。
 * 部署后无需任何外部服务。
 * 
 * 环境变量:
 *   SUB_ONE_URL  - 你的 Sub-One Pages 地址 (例如 https://sub-one.pages.dev)
 *   CRON_SECRET  - Sub-One 后台设置的定时更新密钥
 */

export default {
    async scheduled(
        event: ScheduledEvent,
        env: { SUB_ONE_URL: string; CRON_SECRET: string },
        ctx: ExecutionContext
    ): Promise<void> {
        const baseUrl = (env.SUB_ONE_URL || '').replace(/\/$/, '');
        const token = env.CRON_SECRET || '';

        if (!baseUrl) {
            console.error('[Sub-One Cron] SUB_ONE_URL 环境变量未设置');
            return;
        }

        const triggerUrl = `${baseUrl}/api/cron/trigger?token=${encodeURIComponent(token)}`;

        console.log(`[Sub-One Cron] 触发: ${new Date().toISOString()}`);

        try {
            const response = await fetch(triggerUrl, { method: 'POST' });
            const body = await response.text().catch(() => '');
            console.log(`[Sub-One Cron] 状态: ${response.status}`, body.slice(0, 300));
        } catch (err) {
            console.error('[Sub-One Cron] 请求失败:', err);
        }
    }
};
