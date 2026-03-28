# QQFramBot 设计规格

## 问题定义

QQ 农场是运行在 QQEXMiniProgram（Electron 37 / Chrome 138）中的 Cocos Creator 小游戏。需要一个自动化机器人完成种植、收获、浇水、施肥、偷菜等操作。

核心约束：不逆向协议、不伪造客户端、不修改 QQ 文件。在真实客户端内通过 JS 注入操控游戏。

## 设计决策

### D1: 注入方式 — LLDB + dlopen + V8 API

通过 LLDB 附着到 QQEXMiniProgram 主进程，dlopen 加载自定义 dylib。dylib 通过 `uv_async_send` 在 V8 主线程安全执行 `require('inspector').open(9229)`，开启 Node.js Inspector 端口。

理由：零外部依赖（LLDB 系统自带），不修改文件，不破坏签名。SIP 已关闭。

### D2: 通信方式 — Chrome DevTools Protocol

Bot 通过 CDP WebSocket 连接 inspector。在主进程 context 中调用 `electron.webContents.executeJavaScript()` 向游戏渲染进程注入 JS。

理由：标准协议，`chromiumoxide` crate 提供完整 Rust 绑定。

### D3: 游戏操控方式 — Cocos Creator Scene API

注入到渲染进程的 `game_bridge.js` 通过 Cocos Creator 全局 API（`cc.director`、`cc.find`）遍历场景节点，触发游戏内操作。

### D4: 语言选择 — Rust + C

- 注入 dylib：C（~50 行，调用 V8/libuv C++ ABI）
- 注入加载器：Rust（shell out to lldb）
- 主 Bot：Rust（chromiumoxide + tokio）

## 技术方案

### 架构

```
qqbot-loader (Rust binary)
  → lldb -p <PID> -o 'expr (void*)dlopen("inject.dylib", 2)'
  → inject.dylib 在目标进程内执行
  → uv_async callback 在 V8 线程调用 require('inspector').open(9229)
  → LLDB detach

qqbot (Rust binary)
  → CDP ws://127.0.0.1:9229 连接 inspector
  → Runtime.evaluate 获取 webContents
  → webContents.executeJavaScript(game_bridge.js) 注入到渲染进程
  → game_bridge.js 操控 Cocos Creator API
  → Bot 通过 CDP 消息与 bridge 双向通信
```

### 关键符号（已验证存在于 QQNT.framework）

| 符号 | 用途 |
|------|------|
| `v8::Isolate::GetCurrent()` | 获取当前 V8 隔离区 |
| `v8::Isolate::GetCurrentContext()` | 获取当前执行上下文 |
| `v8::HandleScope::HandleScope(Isolate*)` | 创建句柄作用域 |
| `v8::String::NewFromUtf8(...)` | 创建 JS 字符串 |
| `v8::Script::Compile(Context, String, Origin*)` | 编译 JS |
| `v8::Script::Run(Context)` | 执行 JS |
| `uv_default_loop` / `uv_async_init` / `uv_async_send` | libuv 事件循环调度 |

### 游戏自动化功能

1. **农场管理**：检测地块状态，自动种植/收获/浇水/施肥
2. **好友互动**：巡访好友农场，偷菜，帮忙除草/除虫/浇水
3. **任务调度**：可配置的定时任务，操作间隔随机化（反检测）
4. **状态监控**：实时显示农场状态、库存、好友列表

## 项目结构

```
QQFramBot/
├── Cargo.toml              # Rust workspace
├── inject/
│   ├── inject.c            # 注入 dylib 源码（~50 行）
│   └── Makefile            # cc -shared -o inject.dylib inject.c
├── crates/
│   ├── qqbot-loader/       # 注入加载器
│   │   └── src/main.rs
│   └── qqbot/              # 主 Bot
│       └── src/
│           ├── main.rs
│           ├── cdp.rs      # CDP 客户端封装
│           ├── farm.rs     # 农场操作
│           ├── friend.rs   # 好友操作
│           └── scheduler.rs
└── scripts/
    └── game_bridge.js      # 注入到渲染进程的 JS 桥接
```

## 开放问题

1. 游戏渲染进程的 Cocos Creator scene graph 结构需要在注入后实际探索
2. 操作触发方式（直接调用游戏方法 vs 模拟点击事件）待验证
3. 好友农场的进入/退出 API 需要在运行时发现
