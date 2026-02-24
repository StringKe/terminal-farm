# terminal-farm

QQ/微信农场自动化挂机工具 — 全屏终端 UI + 多账号 + HTTP API

> 基于 [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) 重构

## 特性

### 农场自动化
- **智能种植** — 按土地等级独立计算最优种子（经验/小时效率排名），自动购买+种植+施肥
- **动态效率模型** — 基于实时 RTT + 巡检间隔建模操作开销，精确计算 exp/h
- **全流程管理** — 收获、浇水、除草、除虫、铲除枯死作物，全自动循环
- **土地升级** — 检测可升级地块，自动执行升级
- **智能换种** — 升级后重新评估最优作物，可选始终换种 / 仅升级换种
- **换种保护** — 成长进度超过阈值（默认 80%）的作物不会被铲除
- **有机肥料** — 可选开启有机肥自动施肥，肥料不足时自动补充

### 好友系统
- **好友巡查** — 自动访问好友农场，帮忙浇水/除草/除虫
- **自动偷菜** — 发现可偷的成熟作物自动采摘
- **放虫放草** — 可选开启对好友农场放虫/放草（默认关闭）
- **每日统计** — 持久化记录偷菜/浇水/除草/除虫次数
- **操作限制追踪** — 自动跟踪每日操作次数和经验上限，耗尽后停止
- **好友申请** — 自动接受好友申请（含推送触发）

### 奖励自动领取
- **任务奖励** — 检测已完成的成长/每日任务，自动领取（支持分享翻倍）
- **活跃度奖励** — 日活跃/周活跃达标后自动领取各档位奖励
- **图鉴奖励** — 检测图鉴等级奖励，一键全部领取（含推送触发）
- **邮件奖励** — 自动检查系统邮件，批量领取附件奖励（含推送触发）
- **免费礼包** — 自动领取商店免费礼包（每小时检测）

### 仓库管理
- **自动售果** — 定时扫描背包，自动出售果实类物品换金币

### 平台与架构
- **全屏终端 UI** — Ink (React CLI) 驱动，响应式三档布局
- **多账号** — 每账号独立 WebSocket 连接，数字键/Tab 切换
- **账号独立配置** — 每账号可独立设置种子、换种模式、施肥策略等，实时 UI 调整
- **双平台** — QQ（扫码 + code 复用）/ 微信（一次性 code）
- **HTTP API** — RESTful 接口 + Swagger UI，可选启用
- **服务器推送** — 实时响应土地变化/升级/任务完成/新邮件/图鉴红点等推送
- **断线重连** — 自动检测连接超时，最多 3 次重连尝试
- **拟人模式** — 统一任务调度器，操作间隔抖动 + 随机顺序 + 定期休息，降低检测风险

## 风险提示

> **使用本工具存在账号被封禁的风险，请务必知悉：**

- 自动化操作违反游戏服务条款，可能导致账号被临时或永久封禁
- 长时间在线挂机、高频操作、多账号同时运行均会增加被检测风险
- 内置「拟人模式」可降低但无法消除风险
- **强烈建议不要在主力/重要账号上使用**
- 作者不对因使用本工具造成的任何损失负责

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

## 运行时配置

### 全局配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `farmCheckInterval` | ms | `1000` | 农场巡查频率 |
| `friendCheckInterval` | ms | `10000` | 好友巡查频率 |
| `apiEnabled` | bool | `false` | 启用 HTTP API |
| `apiPort` | number | `3000` | API 端口 |

### 账号独立配置

每账号独立存储（`<gid>.json`），可通过 Settings 面板（`S` 键）实时调整。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `manualSeedId` | number | `0` | 手动指定种子 ID（0=自动推荐） |
| `forceLowestLevelCrop` | bool | `false` | 强制种最便宜的作物（忽略效率） |
| `autoReplantMode` | enum | `'levelup'` | `'levelup'` 升级换种 / `'always'` 始终换种 / `false` 不换 |
| `replantProtectPercent` | 0-100 | `80` | 成长进度超过此值不铲除 |
| `useOrganicFertilizer` | bool | `false` | 额外施有机肥 |
| `autoRefillFertilizer` | bool | `false` | 肥料不足时自动补充 |
| `enablePutBadThings` | bool | `false` | 对好友农场放虫/放草 |
| `autoClaimFreeGifts` | bool | `true` | 自动领取商店免费礼包 |
| `enableHumanMode` | bool | `true` | 拟人模式（操作抖动 + 休息 + 串行化） |
| `humanModeIntensity` | enum | `'medium'` | 拟人强度：`'low'` / `'medium'` / `'high'` |

## 键盘操作

| 按键 | 功能 |
|------|------|
| `1-9` | 切换账号 |
| `Tab` / `Shift+Tab` | 下/上一个账号 |
| `←` / `→` | 切换账号 |
| `↑` / `↓` | 滚动日志 |
| `+` | 添加新账号 |
| `S` | 打开/关闭账号设置面板 |
| `q` / `Ctrl+C` | 退出 |

## HTTP API

启用 `--api` 后，所有端口均为 POST（JSON body），支持 CORS。

| 端点 | 说明 |
|------|------|
| `POST /account/list` | 账号列表 |
| `POST /account/add` | 添加账号 `{platform, code}` |
| `POST /account/remove` | 移除账号 `{id}` |
| `POST /farm/status` | 农场状态 `{accountId}` |
| `POST /farm/harvest` | 触发收获 `{accountId}` |
| `POST /farm/replant` | 触发换种 `{accountId}` |
| `POST /friend/list` | 好友列表+统计 `{accountId}` |
| `POST /friend/patrol` | 触发好友巡查 `{accountId}` |
| `POST /system/logs` | 查看日志 `{limit, offset}` |
| `POST /system/config` | 当前配置 |
| `POST /system/version` | 版本信息 |
| `GET /swagger` | Swagger UI |
| `GET /openapi.json` | OpenAPI 3.0 规范 |

## UI 面板

| 面板 | 内容 |
|------|------|
| **状态栏** | 平台、昵称、等级、金币、经验进度条 |
| **农场** | 地块网格（作物名称、生长进度条、倒计时、状态标记） |
| **背包** | 前 10 种物品及数量 |
| **任务** | 可领取/已完成/总数，前 3 条任务预览 |
| **好友** | 好友列表 + 每日偷菜/浇水/除草/除虫统计 |
| **日志** | 最近 50 条操作日志（可滚动） |

## 经验效率分析

```bash
bun run tools/calc-exp-yield.ts --lands 18 --level 27
```

按土地等级独立计算最优种子排名，输出 exp/h 效率、生长时间、种子价格。

## 项目结构

```
src/
├── main.ts              # 入口，CLI 参数解析
├── app.tsx              # Ink 根组件，路由 login/dashboard
├── core/                # 业务逻辑
│   ├── session.ts       # 单账号编排 (Connection + Store + Managers)
│   ├── account.ts       # 多账号管理
│   ├── scheduler.ts     # 统一任务调度器（拟人模式 + 休息调度）
│   ├── farm.ts          # 农场操作 + 土地升级
│   ├── friend.ts        # 好友巡查
│   ├── task.ts          # 任务 + 活跃度奖励领取
│   ├── warehouse.ts     # 仓库自动售果
│   ├── illustrated.ts   # 图鉴奖励自动领取
│   ├── email.ts         # 邮件奖励自动领取
│   ├── exp-calculator.ts # 经验效率计算器（动态 RTT 建模）
│   ├── shop.ts          # 商店免费礼包领取
│   └── invite.ts        # 微信邀请码处理
├── protocol/            # 协议层
│   ├── connection.ts    # WebSocket 连接（每账号独立实例）
│   ├── codec.ts         # Protobuf 编解码
│   ├── proto-loader.ts  # 消息类型注册
│   └── login.ts         # 登录流程
├── store/               # 状态管理 (EventEmitter → React)
├── ui/                  # 终端 UI (screens, panels, hooks, components)
├── config/              # 配置 + 游戏数据
├── api/                 # HTTP API (Bun.serve)
└── utils/               # 工具函数
```

## 技术栈

| 层 | 技术 |
|----|------|
| Runtime | Bun |
| Language | TypeScript (ESM) |
| UI | Ink 6 (React for CLI) |
| Protocol | Protobuf (protobufjs) |
| Lint | Biome |
| Validation | Zod |

## 注意事项

- QQ 平台成功登录后 code 自动保存至 `.farm-code.json`，下次可直接复用
- 微信 code 仅一次性使用，每次需重新获取
- 服务器有每日操作次数限制，bot 自动跟踪并停止已耗尽的操作
- 请合理设置巡查间隔，过于频繁可能触发限流

## 版本更新

游戏客户端更新后，bot 可能因版本号或服务器地址过期而无法连接。

欢迎开发者通过 PR 更新 `.version.json`：
- `app.clientVersion` — 客户端版本号
- `game.serverUrl` — WebSocket 服务器地址

获取方式：使用 Charles/Fiddler 抓包小程序，从 WebSocket 连接中获取。

## 免责声明

本项目仅供学习和研究用途。使用本工具可能违反游戏服务条款，由此产生的一切后果由使用者自行承担。

## 致谢

- [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) — 原始项目
- [lkeme/QRLib](https://github.com/lkeme/QRLib) — 扫码登录参考

## License

[MIT](LICENSE)
