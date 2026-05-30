/// <reference types="@cloudflare/workers-types" />
/**
 * Sub-One Pages Advanced Mode 入口 (_worker.ts)
 * 
 * 替代原来的 functions/[[path]].ts。
 * 使用 Pages Advanced Mode，支持：
 * - fetch: 处理所有 HTTP 请求（等价于 onRequest）
 * - scheduled: CF 原生 Cron 定时器（无需外部 HTTP 触发）
 * 
 * 继续使用 wrangler pages deploy 部署，无需切换到 Worker 模式。
 */

import { handleApiRequest } from '../lib/backend/api/handlers';
import { handleSubRequest } from '../lib/backend/subscription/handler';
import { handleCronTrigger } from '../lib/backend/cron/index';
import { Env } from '../lib/backend/types';

const FRONTEND_ROUTES = ['/dashboard', '/subscriptions', '/profiles', '/nodes', '/login'];
const STATIC_ASSET_REGEX = /^\/(assets|@vite|src)\/./;
const FILE_EXT_REGEX = /\.\w+$/;

export default {
    /**
     * fetch handler - 所有 HTTP 请求的入口
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // 1. API 路由
        if (url.pathname.startsWith('/api/')) {
            return handleApiRequest(request, env);
        }

        // 2. SPA 前端路由 → 返回 index.html
        if (FRONTEND_ROUTES.includes(url.pathname)) {
            return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
        }

        // 3. 检查是否为静态资源
        const isStaticAsset = STATIC_ASSET_REGEX.test(url.pathname) || FILE_EXT_REGEX.test(url.pathname);

        // 4. 订阅请求（非静态、非 API 路径）
        if (!isStaticAsset && url.pathname !== '/') {
            try {
                return await handleSubRequest({ request, env } as any);
            } catch (err: any) {
                console.error('[Worker Error]', err);
                return new Response('Internal Server Error', { status: 500 });
            }
        }

        // 5. 兜底：尝试静态文件，失败回退到 index.html
        try {
            return await env.ASSETS.fetch(request);
        } catch {
            return await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
        }
    },

    /**
     * scheduled handler - CF 原生 Cron 触发
     * 在 Cloudflare Dashboard → Pages → 设置 → Functions → Cron 触发器中配置
     * 例如 cron 表达式: 0 0 * * * (每天零点)
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log('[Sub-One Cron] Scheduled trigger fired at', new Date().toISOString());
        try {
            const response = await handleCronTrigger(env);
            const body = await response.text().catch(() => '');
            console.log('[Sub-One Cron] 执行完成:', response.status, body.slice(0, 200));
        } catch (err) {
            console.error('[Sub-One Cron] 执行失败:', err);
        }
    }
};
