/// <reference types="@cloudflare/workers-types" />
/**
 * Sub-One Cloudflare Pages Functions 主入口
 * 
 * 使用 Pages Functions 路由模式 ([[path]].ts)。
 * 定时更新通过外部 HTTP 调用 /api/cron/trigger 实现。
 */

import { handleApiRequest } from '../lib/backend/api/handlers';
import { handleSubRequest } from '../lib/backend/subscription/handler';
import { Env } from '../lib/backend/types';

export async function onRequest(context: EventContext<Env, any, any>) {
    const { request, env, next } = context;
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
        const response = await handleApiRequest(request, env);
        return response;
    }

    const isStaticAsset =
        /^\/(assets|@vite|src)\/./.test(url.pathname) || /\.\w+$/.test(url.pathname);

    const frontendRoutes = ['/dashboard', '/subscriptions', '/profiles', '/nodes', '/login'];
    if (frontendRoutes.includes(url.pathname)) {
        return env.ASSETS.fetch(new Request(new URL('/', request.url)));
    }

    if (!isStaticAsset && url.pathname !== '/') {
        try {
            return await handleSubRequest(context);
        } catch (err: any) {
            console.error('[Top Level Error]', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    }

    return next();
}
