# terminal-farm

QQ/微信农场自动化挂机工具 -- 全屏终端 UI + 多账号 + HTTP API + Docker

> 基于 [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) 重构

## 风险提示

> **使用本工具存在账号被封禁的风险，请务必知悉：**

- 自动化操作违反游戏服务条款，可能导致账号被临时或永久封禁
- 长时间在线挂机、高频操作、多账号同时运行均会增加被检测风险
- 内置拟人模式可降低但无法消除风险
- **强烈建议不要在主力/重要账号上使用**
- 作者不对因使用本工具造成的任何损失负责

> **严禁将本项目用于任何形式的商业盈利活动：**

- **严禁**基于本项目搭建付费代挂服务、收费 SaaS 平台或任何形式的盈利性服务
- **严禁**以本项目为基础向他人收取费用，包括但不限于代挂费、会员费、订阅费
- **严禁**将本项目的 API、Docker 镜像或衍生产品用于商业运营
- 违反上述条款的行为，作者保留追究法律责任的权利
- 本项目仅供个人学习和研究使用，发现商业化滥用将立即停止维护并关闭仓库

## 特性

### 农场自动化

- **智能选种** -- exp/h 动态效率模型，综合生长时间、施肥加成、RTT、调度器开销计算最优种子
- **全流程管理** -- 收获、浇水、除草、除虫、铲除枯死，全自动循环
- **自动施肥** -- 普通肥 + 有机肥双通道，肥料不足时自动从背包补充
- **智能换种** -- 升级后重新评估最优作物，可选始终换种 / 仅升级换种 / 不换
- **换种保护** -- 成长进度超过阈值（默认 80%）的作物不会被铲除
- **土地自动解锁/升级** -- 检测到可解锁或可升级地块，自动执行
- **图鉴解锁模式** -- 自动用一块地种未收录植物完成图鉴收集，与换种逻辑互不冲突

### 好友系统

- **好友巡查** -- 自动访问好友农场，帮忙浇水/除草/除虫
- **自动偷菜** -- 发现可偷的成熟作物自动采摘（可关闭）
- **帮好友** -- 自动除草/除虫/浇水（可关闭）
- **放虫放草** -- 可选开启对好友农场放虫/放草（默认关闭）
- **仅限有经验时帮助** -- 可选开关，关闭后即使无经验也会帮助好友（默认开启）
- **操作限制追踪** -- 自动跟踪每日操作次数和经验上限，耗尽后停止
- **好友申请** -- 自动接受好友申请（含推送触发）

### 操作统计

- **12 维指标** -- 自家（除草/除虫/浇水/收获/种植/施肥）+ 好友（除草/除虫/浇水/偷菜/放草/放虫）
- **多时间维度** -- 今日 / 本周 / 本月 / 累计，`[`/`]` 键实时切换
- **历史归档** -- 跨日自动归档到 `data/stats-history.json`，支持累计聚合
- **启动恢复** -- 重启后自动从 `data/stats.json` 恢复当日数据

### 每日奖励自动领取

| 模块 | 说明 | 检查间隔 |
|------|------|---------|
| 任务奖励 | 成长/每日任务完成后自动领取（支持分享翻倍） | 5 分钟 |
| 活跃度奖励 | 日活跃/周活跃达标后自动领取各档位 | 5 分钟 |
| 图鉴奖励 | 图鉴等级奖励一键全部领取 | 1 小时 + 推送触发 |
| 邮件奖励 | 系统邮件批量领取附件奖励 | 1 小时 + 推送触发 |
| 商店免费礼包 | 商店中价格为 0 的免费商品 | 1 小时 |
| 商城免费礼包 | 遍历所有商城分类，领取免费且未达上限的商品 | 1 小时 |
| 月卡每日奖励 | 已激活月卡自动领取每日奖励，无月卡自动跳过 | 1 小时 |
| 红包活动 | 查询所有活动状态，领取可用红包 | 1 小时 + 推送触发 |
| QQ 会员礼包 | QQ 会员每日专属礼包 | 1 小时 + 推送触发 |
| 每日分享 | 启动时探测分享可用性并尝试领取奖励 | 启动一次 |

### 仓库管理

- **自动售果** -- 定时扫描背包，自动出售果实类物品换金币
- **自动开礼包** -- 可选自动使用礼包类物品

### 拟人模式

统一任务调度器内置三档拟人强度，降低检测风险：

| 强度 | 操作抖动 | 任务间延迟 | 休息间隔 | 休息时长 |
|------|---------|-----------|---------|---------|
| 低 | 20% | 100-300ms | 30-60 分钟 | 30-60 秒 |
| 中（默认） | 35% | 200-500ms | 15-40 分钟 | 60-180 秒 |
| 高 | 50% | 300-800ms | 8-20 分钟 | 120-300 秒 |

操作顺序随机打乱，任务执行串行化，定期自动休息。

### 平台与架构

- **全屏终端 UI** -- Ink (React CLI) 驱动，响应式布局
- **Headless 模式** -- 无 UI 纯 API 服务，适合 Docker / 服务器部署
- **多账号** -- 每账号独立 WebSocket 连接、Store、调度器
- **账号独立配置** -- 每账号可独立设置种子、换种模式、施肥策略等，实时 UI 调整
- **双平台** -- QQ（扫码 + code 复用）/ 微信（一次性 code）
- **HTTP API** -- RESTful 接口 + Swagger UI + Bearer Token 鉴权
- **服务器推送** -- 实时响应土地变化/升级/任务完成/新邮件/图鉴红点/红包状态等推送
- **断线重连** -- 自动检测连接超时，最多 3 次重连尝试
- **中国时间** -- 所有每日重置判断基于 UTC+8，UI 同时显示本机时间和游戏时间

## 快速开始

### 本地运行（终端 UI）

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

### Docker 部署（Headless API）

```bash
# 使用已有 code 启动
docker run -d \
  --name terminal-farm \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/stringke/terminal-farm \
  --code <CODE> --api-key <SECRET>

# 无 code 启动，通过 API 扫码登录
docker run -d \
  --name terminal-farm \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/stringke/terminal-farm \
  --api-key <SECRET>
```

Docker 镜像支持 `linux/amd64` 和 `linux/arm64` 双架构，每次推送 main 分支自动构建。

### Docker Compose

```yaml
services:
  terminal-farm:
    image: ghcr.io/stringke/terminal-farm:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    command: ["--code", "<CODE>", "--api-key", "<SECRET>"]
```

## CLI 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--code <code>` | 登录 code | 扫码登录 |
| `--qq` | QQ 平台 | 默认 |
| `--wx` | 微信平台 | -- |
| `--interval <秒>` | 农场巡查间隔 | `1` |
| `--friend-interval <秒>` | 好友巡查间隔 | `10` |
| `--api` | 启用 HTTP API | 关闭 |
| `--api-port <端口>` | API 端口 | `3000` |
| `--api-host <地址>` | API 绑定地址 | `127.0.0.1` |
| `--api-key <密钥>` | API 鉴权密钥（设置后所有请求需 Bearer Token） | 无（不鉴权） |
| `--headless` | 无 UI 模式，仅启动核心逻辑 + API 服务 | 关闭 |
| `--verify` | 验证 proto 加载后退出 | -- |

Headless 模式会强制启用 API 服务。未提供 `--code` 且无保存的登录态时，进程会保持运行并等待通过 API 登录。

## 键盘操作

| 按键 | 功能 |
|------|------|
| `1-9` | 切换账号 |
| `Tab` / `Shift+Tab` | 下/上一个账号 |
| `←` / `→` | 切换账号 |
| `↑` / `↓` | 滚动日志 |
| `[` / `]` | 切换统计视图（今日/本周/本月/累计） |
| `+` | 添加新账号 |
| `S` | 打开/关闭账号设置面板 |
| `Q` / `Ctrl+C` | 退出 |

## 账号配置

每账号独立存储于 `data/accounts/<gid>.json`，可通过设置面板（`S` 键）实时调整。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `manualSeedId` | number | `0` | 手动指定种子 ID（0=自动推荐） |
| `forceLowestLevelCrop` | bool | `false` | 强制种最便宜的作物（忽略效率） |
| `autoReplantMode` | enum | `levelup` | `levelup` 升级换种 / `always` 始终换种 / `false` 不换 |
| `replantProtectPercent` | 0-100 | `80` | 成长进度超过此值不铲除 |
| `useNormalFertilizer` | bool | `true` | 自动施普通肥 |
| `autoRefillNormalFertilizer` | bool | `false` | 普通肥不足时自动补充 |
| `useOrganicFertilizer` | bool | `false` | 额外施有机肥 |
| `autoRefillOrganicFertilizer` | bool | `false` | 有机肥不足时自动补充 |
| `enableFriendSteal` | bool | `true` | 自动偷好友菜 |
| `enableFriendHelp` | bool | `true` | 自动帮好友（除草/除虫/浇水） |
| `helpOnlyWithExp` | bool | `true` | 帮好友仅限有经验时（关闭后无经验也帮） |
| `enablePutBadThings` | bool | `false` | 对好友农场放虫/放草 |
| `autoClaimFreeGifts` | bool | `true` | 自动领取商店免费礼包 |
| `autoUseGiftPacks` | bool | `true` | 自动使用礼包类物品 |
| `enableHumanMode` | bool | `true` | 拟人模式 |
| `humanModeIntensity` | enum | `medium` | 拟人强度：`low` / `medium` / `high` |
| `enableIllustratedUnlock` | bool | `false` | 图鉴解锁模式（优先种未收录植物） |

## UI 面板

| 面板 | 内容 |
|------|------|
| **状态栏** | 平台、昵称、等级、金币、经验进度条、拟人状态、本机/游戏双时间 |
| **农场** | 地块网格（作物名称、生长进度条、倒计时、缺水/有草/有虫/突变标记） |
| **背包** | 前 10 种物品及数量 |
| **任务** | 可领取/已完成/总数，前 3 条任务预览 |
| **好友** | 好友列表（有操作/无操作分区）+ 自家/好友双行 12 维统计 + 视图切换 |
| **日志** | 最近操作日志（可滚动），本机时间 + 游戏时间标题 |
| **设置** | 账号独立配置编辑器（↑↓ 选择，Enter/空格 切换） |

## HTTP API

启用 `--api`（或 `--headless`）后可用，所有端点返回 `{ ok, data?, error? }` JSON。

### 鉴权

设置 `--api-key <密钥>` 后，所有非公开端点需要携带 `Authorization: Bearer <密钥>` 请求头，否则返回 401。

公开端点（无需鉴权）：`GET /health`、`GET /swagger`、`GET /openapi.json`

### 端点列表

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查，返回 `{ok, uptime}` |
| `POST /login/qr-create` | 创建 QR 登录会话，返回二维码 URL 和终端文本 |
| `POST /login/qr-poll` | 轮询扫码结果 `{loginCode, platform?}`，成功返回账号信息 |
| `POST /account/list` | 账号列表 |
| `POST /account/add` | 添加账号 `{platform, code}` |
| `POST /account/remove` | 移除账号 `{id}` |
| `POST /farm/status` | 农场状态（土地+用户+背包+天气+调度器）`{accountId}` |
| `POST /farm/harvest` | 触发巡田 `{accountId}` |
| `POST /farm/replant` | 触发换种 `{accountId}` |
| `POST /friend/list` | 好友列表+巡查进度+统计（含 12 维指标）`{accountId}` |
| `POST /friend/patrol` | 触发好友巡查 `{accountId}` |
| `POST /stats/summary` | 统计聚合（今日/本周/本月/累计）`{accountId}` |
| `POST /stats/history` | 统计历史记录 |
| `POST /system/logs` | 查看日志 `{limit, offset}` |
| `POST /system/config` | 当前运行时配置 |
| `POST /system/version` | 版本信息 |
| `GET /swagger` | Swagger UI |
| `GET /openapi.json` | OpenAPI 3.0 规范 |

### QR 扫码登录流程（API）

适用于 Headless / Docker 部署场景，无终端时通过 API 完成 QQ 扫码登录：

```bash
# 1. 创建 QR 会话
curl -X POST http://localhost:3000/login/qr-create \
  -H "Authorization: Bearer <api-key>"

# 响应: { ok: true, data: { loginCode: "xxx", url: "https://...", qrText: "..." } }
# 用浏览器打开 url 或用手机 QQ 扫描 qrText 中的二维码

# 2. 轮询扫码结果（扫码后调用）
curl -X POST http://localhost:3000/login/qr-poll \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{"loginCode": "xxx"}'

# 等待中: { ok: true, data: { status: "waiting" } }
# 成功:   { ok: true, data: { id: "account-1", code: "xxx" } }
```

## 经验效率分析

```bash
bun run tools/calc-exp-yield.ts --lands 18 --level 27
```

离线计算工具，按土地数量和等级输出 exp/h 排名、生长时间、种子价格。模型与运行时选种一致。

## 项目结构

```
src/
├── main.ts                # 入口，CLI 参数解析，UI / Headless 分支
├── app.tsx                # Ink 根组件，路由 login/dashboard
├── core/                  # 业务逻辑
│   ├── session.ts         # 单账号编排 (Connection + Store + Managers)
│   ├── account.ts         # 多账号管理
│   ├── scheduler.ts       # 统一任务调度器（拟人模式 + 休息）
│   ├── farm.ts            # 农场操作 + 选种 + 土地升级
│   ├── friend.ts          # 好友巡查 + 偷菜 + 放虫放草
│   ├── task.ts            # 任务 + 活跃度奖励
│   ├── warehouse.ts       # 仓库自动售果 + 开礼包
│   ├── illustrated.ts     # 图鉴奖励 + 解锁查询
│   ├── email.ts           # 邮件奖励
│   ├── weather.ts         # 天气预报
│   ├── qqvip.ts           # QQ 会员礼包
│   ├── redpacket.ts       # 红包活动
│   ├── mall.ts            # 商城免费礼包 + 月卡 + 分享
│   ├── shop.ts            # 商店免费礼包
│   ├── exp-calculator.ts  # 经验效率计算器
│   └── invite.ts          # 微信邀请码处理
├── protocol/              # 协议层
│   ├── connection.ts      # WebSocket 连接 + 推送分发
│   ├── proto-loader.ts    # Protobuf 消息类型注册
│   └── ws-dumper.ts       # 消息 dump 调试
├── store/                 # 状态管理 (EventEmitter -> React)
├── ui/                    # 终端 UI (screens, panels, hooks, components)
├── config/                # 配置 + 游戏数据 + 路径管理
├── api/                   # HTTP API (Bun.serve + 鉴权)
│   └── handlers/          # 路由处理器（account, farm, friend, login, stats, system）
└── utils/                 # 工具函数（日志、时间、格式化）

proto/                     # Protobuf 协议定义
game-config/               # 静态游戏数据 (Plant.json, RoleLevel.json, ItemInfo.json)
data/                      # 运行时数据（gitignore）
├── accounts/{gid}.json    # 账号独立配置
├── code.json              # QQ 登录码持久化
├── stats.json             # 当日统计（12 维指标）
├── stats-history.json     # 统计历史归档（跨日自动追加）
├── share.txt              # 微信邀请码
├── logs/YYYY-MM-DD.log    # 日志（每日轮转）
└── dumps/                 # WebSocket 消息 dump
```

## CI/CD

每次推送 `main` 分支自动触发 GitHub Actions：

| Job | 产物 | 说明 |
|-----|------|------|
| **build** | GitHub Release | 编译 5 个平台二进制文件（linux-x64/arm64, darwin-x64/arm64, windows-x64） |
| **docker** | GHCR 镜像 | 构建并推送 `ghcr.io/stringke/terminal-farm`，支持 `linux/amd64` + `linux/arm64` 双架构 |

镜像 tag 规则：
- `latest` -- 最新 main 分支
- `<commit-sha>` -- 精确到提交

拉取镜像：

```bash
docker pull ghcr.io/stringke/terminal-farm:latest
```

## 技术栈

| 层 | 技术 |
|----|------|
| Runtime | Bun |
| Language | TypeScript (ESM) |
| UI | Ink 6 (React for CLI) |
| Protocol | Protobuf (protobufjs) |
| API | Bun.serve + Bearer Token 鉴权 |
| Container | Docker (oven/bun) |
| CI/CD | GitHub Actions |
| Lint | Biome |
| Validation | Zod |

## 注意事项

- QQ 平台成功登录后 code 自动保存至 `data/code.json`，下次可直接复用
- 微信 code 仅一次性使用，每次需重新获取
- 服务器有每日操作次数限制，bot 自动跟踪并停止已耗尽的操作
- 请合理设置巡查间隔，过于频繁可能触发限流
- 所有每日功能基于中国时间 (UTC+8) 重置
- API 默认绑定 `127.0.0.1`，Docker 中自动绑定 `0.0.0.0`
- 建议在公网部署时设置 `--api-key` 防止未授权访问

## 版本更新

游戏客户端更新后，bot 可能因版本号或服务器地址过期而无法连接。

欢迎开发者通过 PR 更新 `.version.json`：
- `app.clientVersion` -- 客户端版本号
- `game.serverUrl` -- WebSocket 服务器地址

获取方式：使用 Charles/Fiddler 抓包小程序，从 WebSocket 连接中获取。

## 免责声明

本项目仅供个人学习和研究用途。严禁将本项目用于任何形式的商业盈利活动。使用本工具可能违反游戏服务条款，由此产生的一切后果由使用者自行承担。

## 致谢

- [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) -- 原始项目

## License

[MIT](LICENSE)
