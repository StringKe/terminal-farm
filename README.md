# terminal-farm

QQ/微信农场自动化挂机工具 — 全屏终端 UI + 多账号 + HTTP API

> 基于 [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) 重构

## 特性

- **全屏终端 UI** — Ink (React CLI) 驱动，响应式三档布局
- **多账号** — 数字键/Tab 切换，每账号独立 WebSocket 连接
- **自动农场** — 收获、种植、施肥、除草、除虫、浇水，智能换种（经验效率排名）
- **好友巡查** — 帮忙除草除虫浇水、自动偷菜，每日统计持久化
- **自动任务** — 检测并领取可完成的任务奖励
- **HTTP API** — RESTful 接口，可选启用
- **双平台** — QQ（扫码 + code 复用）/ 微信（一次性 code）

## 快速开始

```bash
# 安装 Bun
mise install        # 或 curl -fsSL https://bun.sh/install | bash

# 安装依赖
bun install

# QQ 扫码登录
bun run src/main.ts

# code 登录（QQ 支持复用）
bun run src/main.ts --code <code>

# 微信
bun run src/main.ts --code <code> --wx
```

## CLI 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--code <code>` | 登录 code | 扫码登录 |
| `--wx` | 微信平台 | QQ |
| `--interval <秒>` | 农场巡查间隔 | `1` |
| `--friend-interval <秒>` | 好友巡查间隔 | `10` |
| `--api` | 启用 HTTP API | 关闭 |
| `--api-port <端口>` | API 端口 | `3000` |
| `--verify` | 验证 proto 加载后退出 | — |

## 键盘操作

| 按键 | 功能 |
|------|------|
| `1-9` | 切换账号 |
| `Tab` / `Shift+Tab` | 下/上一个账号 |
| `+` | 添加新账号 |
| `↑` / `↓` | 滚动日志 |
| `q` / `Ctrl+C` | 退出 |

## 技术栈

| 层 | 技术 |
|----|------|
| Runtime | Bun |
| Language | TypeScript (ESM) |
| UI | Ink 6 (React for CLI) |
| Protocol | Protobuf (protobufjs) |
| Lint | Biome |
| Validation | Zod |

## 项目结构

```
src/
├── main.ts              # 入口，CLI 参数解析
├── app.tsx              # Ink 根组件，路由 login/dashboard
├── core/                # 业务逻辑
│   ├── session.ts       # 单账号编排 (Connection + Store + Managers)
│   ├── account.ts       # 多账号管理
│   ├── farm.ts          # 农场操作循环
│   ├── friend.ts        # 好友巡查循环
│   └── task.ts          # 任务检测与领取
├── protocol/            # 协议层
│   ├── connection.ts    # WebSocket 连接（每账号独立实例）
│   ├── codec.ts         # Protobuf 编解码
│   └── login.ts         # 登录流程
├── store/               # 状态管理 (EventEmitter → React)
│   ├── session-store.ts # 单账号状态
│   ├── account-store.ts # 账号列表状态
│   └── persist.ts       # JSON 持久化
├── ui/                  # 终端 UI
│   ├── screens/         # 页面 (login, dashboard)
│   ├── panels/          # 面板 (farm, bag, friend, task, log)
│   ├── hooks/           # React hooks
│   └── components/      # 通用组件
├── config/              # 配置 + 游戏数据
├── api/                 # HTTP API (Bun.serve)
└── utils/               # 工具函数
```

## 注意事项

- QQ 平台成功登录后 code 自动保存至 `.farm-code.json`，下次可直接复用
- 微信 code 仅一次性使用，每次需重新获取
- 服务器有每日操作次数限制，bot 自动跟踪并停止已耗尽的操作
- 请合理设置巡查间隔，过于频繁可能触发限流

## 免责声明

本项目仅供学习和研究用途。使用本工具可能违反游戏服务条款，由此产生的一切后果由使用者自行承担。

## 致谢

- [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) — 原始项目
- [lkeme/QRLib](https://github.com/lkeme/QRLib) — 扫码登录参考

## License

[MIT](LICENSE)
