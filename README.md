# Pi Chat Agent

一个基于 Pi Agent Core 的轻量大模型对话应用：React 前端由 Cloudflare Workers Static Assets 托管，`/api/chat/completions` 由同一个 Cloudflare Worker 运行。

## 功能

- 在界面配置 OpenAI 兼容接口的 Base URL、API Key、模型 ID 和系统提示词
- 设置与对话历史保存在浏览器 `localStorage`
- API Key 仅在请求时传给 Worker，不写入数据库或服务端配置
- 使用 Pi Agent Core 调用任意 OpenAI 兼容接口
- 支持 Cloudflare 单域名部署，不依赖飞书或妙搭登录

## 本地运行

要求 Node.js 22 及以上版本。

```bash
npm install
npm run dev
```

Wrangler 会输出本地访问地址。修改代码后重新运行即可。

## 检查和构建

```bash
npm run lint
npm run build
npm run type:check:worker
npx wrangler deploy --dry-run
```

## 发布到 Cloudflare

首次使用先登录 Cloudflare：

```bash
npx wrangler login
npm run deploy:cloudflare
```

部署配置位于 `wrangler.jsonc`。静态文件从 `dist/client` 发布，API 入口为 `worker/index.ts`。

## 安全说明

不要把模型 API Key 写入仓库、Wrangler 配置或 GitHub Actions 日志。用户应在网页模型设置中填写自己的 Base URL 和 Key。
