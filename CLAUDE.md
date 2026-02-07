# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**terminal-farm** — QQ/微信经典农场小程序自动化挂机工具。全屏终端 UI + HTTP API，支持多账号。

技术栈：Bun + TypeScript + Ink (React CLI) + ESM + Protobuf

前身项目：[qq-farm-bot](https://github.com/StringKe/qq-farm-bot)

## 常用命令

```bash
# 运行时管理 (mise)
mise install          # 安装 bun

# 安装依赖
bun install

# 启动（全屏 UI，QQ 扫码登录）
bun run src/main.ts

# 指定 code 登录
bun run src/main.ts --code <code>

# 微信平台
bun run src/main.ts --code <code> --wx

# 自定义间隔（秒）
bun run src/main.ts --interval 5 --friend-interval 2

# 启用 HTTP API
bun run src/main.ts --api --api-port 3000

# 验证 proto 加载
bun run src/main.ts --verify

# Lint / Format
bunx biome check .
bunx biome format --write .

# 经验效率分析
bun run tools/calc-exp-yield.ts --lands 18 --level 27
```

无构建步骤，Bun 直跑 TypeScript。无测试套件。

## 架构

### 分层

```
src/main.ts (入口，CLI 参数解析)
  → app.tsx (Ink 根组件，路由 login/dashboard)
    → ui/ (screens, panels, hooks, components)
  → core/ (业务逻辑，纯 TS)
    → session.ts (单账号编排: Connection + Store + Managers)
    → account.ts (多账号管理)
    → farm.ts / friend.ts / task.ts / warehouse.ts
  → protocol/ (协议层)
    → connection.ts (实例化 WebSocket，非单例)
    → codec.ts / proto-loader.ts / login.ts
  → store/ (状态管理，EventEmitter 驱动)
    → session-store.ts / account-store.ts
  → config/ (配置 + 游戏数据)
  → api/ (HTTP API, Bun.serve)
  → utils/ (日志、时间、格式化)
```

### 多账号模型

每个账号是一个独立 Session 实例（自己的 WebSocket、Store、循环管理器）。UI 通过 Tab/数字键切换当前查看的账号。

### 状态→UI 数据流

`Connection` 事件 → `SessionStore` 更新 → `useSessionState` hook 触发 React re-render → Panel 组件刷新

### 关键设计

- **协议驱动**：所有通信通过 `proto/` 定义的 Protobuf 消息，gatepb 为网关包装层
- **消息类型**：请求=1，响应=2，推送通知=3
- **Connection 实例化**：每个账号独立 WebSocket 连接（非全局单例）
- **循环调度**：farm/friend/warehouse 各自独立 setInterval 循环
- **登录码持久化**：QQ 平台成功登录后保存至 `.farm-code.json`

### 配置层次

1. `.version.json` — 版本号、服务器地址（集中管理）
2. `src/config/schema.ts` — Zod schema 定义所有配置项
3. `src/config/index.ts` — 默认值 + 运行时 updateConfig()
4. CLI 参数 — 覆盖 platform/interval/api 等
5. `game-config/` — 静态游戏数据（Plant.json, RoleLevel.json, ItemInfo.json）

### 上游同步

通过 `.parent-commit` 文件记录旧仓库最后同步的 commit hash，使用 `/sync-upstream` Skill 实现逻辑级别的上游同步。

## 注意事项

- QQ 支持扫码 + code 复用；微信仅一次性 code
- 服务器有每日操作次数限制，bot 自动跟踪
- 日志输出到 `logs/YYYY-MM-DD.log`（每日轮转）+ 内存 ring buffer → UI
- Conventional commits 规范
