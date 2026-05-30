/// <reference types="@cloudflare/workers-types" />
/**
 * Sub-One Cloudflare Worker 入口（支持原生 Cron 定时器）
 * 
 * 与 functions/[[path]].ts 的功能等价，额外支持 CF Workers 的 scheduled 事件。
 * 
 * 部署方式:
 *   wrangler deploy
 * 
 * Pages 兼容: functions/[[path]].ts 仍然保留，用于 Pages 部署。
 */

import { handleApiRequest } from '../lib/backend/api/handlers';
import { handleSubRequest } from '../lib/backend/subscription/handler';
import { handleCronTrigger } from '../lib/backend/cron/index';
import { Env } from '../lib/backend/types';

const FRONTEND_ROUTES = ['/dashboard', '/subscriptions', '/profiles', '/nodes', '/login'];
const STATIC_ASSET_REGEX = /^\/(assets|@vite|src)\/./;
const FILE_EXT_REGEX = /\.\w+$/;

/**
 * Worker fetch handler - 处理所有 HTTP 请求
 */
async function fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. API 路由
    if (url.pathname.startsWith('/api/')) {
        return handleApiRequest(request, env);
    }

    // 2. SPA 前端路由 → 返回 index.html
    if (FRONTEND_ROUTES.includes(url.pathname)) {
        return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }

    // 3. 静态资源 (js, css, 图片等)
    const isStaticAsset = STATIC_ASSET_REGEX.test(url.pathname) || FILE_EXT_REGEX.test(url.pathname);

    // 4. 订阅请求 (非静态、非 API 路径)
    if (!isStaticAsset && url.pathname !== '/') {
        try {
            // handleSubRequest 只需要 request 和 env
            return await handleSubRequest({ request, env } as any);
        } catch (err: any) {
            console.error('[Worker fetch error]', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    }

    // 5. 兜底: 尝试返回静态文件，失败回退到 index.html
    try {
        return await env.ASSETS.fetch(request);
    } catch {
        return await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }
}

/**
 * Worker scheduled handler - CF Workers 原生 Cron 触发器
 * 
 * 当 wrangler.toml 中 [triggers] crons 触发时自动调用。
 * 直接调用 handleCronTrigger(env)，无需外部 HTTP 请求、无需 cronSecret 鉴权。
 */
async function scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    console.log('[Sub-One Cron] Scheduled trigger fired at', new Date().toISOString());

    try {
        // 直接调用 cron 处理器（handleCronTrigger 内部自动检查 cronEnabled）
        const response = await handleCronTrigger(env);
        const body = await response.text().catch(() => '');
        console.log('[Sub-One Cron] 执行完成:', response.status, body.slice(0, 200));
    } catch (err) {
        console.error('[Sub-One Cron] 执行失败:', err);
    }
}

export default { fetch, scheduled };
