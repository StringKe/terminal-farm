# terminal-farm

全屏终端 QQ/微信农场自动化挂机工具。

基于 [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) 重构，采用现代化技术栈。

## 特性

- 全屏终端 UI（Ink / React CLI）
- 多账号支持（Tab 切换）
- 自动收获、种植、施肥、除草、除虫、浇水
- 好友巡查、帮忙、偷菜
- 自动任务领取
- 智能换种（经验效率排名）
- HTTP API + Swagger UI
- 响应式布局（窄屏自动堆叠）

## 快速开始

```bash
# 安装 Bun（通过 mise）
mise install

# 安装依赖
bun install

# 启动（QQ 扫码登录）
bun run src/main.ts

# 指定 code 登录
bun run src/main.ts --code <code>

# 微信平台
bun run src/main.ts --code <code> --wx
```

## CLI 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--code <code>` | 登录 code | 扫码 |
| `--wx` | 使用微信平台 | QQ |
| `--interval <秒>` | 农场巡查间隔 | 1 |
| `--friend-interval <秒>` | 好友巡查间隔 | 10 |
| `--api` | 启用 HTTP API | 关闭 |
| `--api-port <端口>` | API 端口 | 3000 |
| `--verify` | 验证 proto 加载 | - |

## 技术栈

- **Runtime**: Bun
- **Language**: TypeScript (ESM)
- **UI**: Ink 6 (React for CLI)
- **Protocol**: Protobuf (protobufjs)
- **Lint/Format**: Biome
- **配置校验**: Zod

## 注意事项

1. QQ 平台支持扫码登录和 code 复用；微信 code 仅一次性使用
2. 请合理设置巡查间隔，过于频繁可能触发服务器限流
3. 服务器有每日操作次数限制，bot 会自动跟踪并停止已耗尽的操作

## 免责声明

本项目仅供学习和研究用途。使用本脚本可能违反游戏服务条款，由此产生的一切后果由使用者自行承担。

## 致谢

- [qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) — 原始项目
- [lkeme/QRLib](https://github.com/lkeme/QRLib) — 扫码登录参考

## License

MIT
