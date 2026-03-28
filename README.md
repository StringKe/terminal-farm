# QQFramBot

通过注入 QQ 小程序进程实现的 QQ 农场自动化机器人。在真实客户端内操作，不逆向协议，不伪造客户端。

## 原理

QQ 农场运行在 QQEXMiniProgram（Electron 37 / Cocos Creator）中。通过 LLDB 将 dylib 注入主进程，dylib 在 V8 主线程启动一个 TCP RPC 服务，Rust bot 连接 RPC 向游戏页面注入 JS 并执行操作。

```
                    LLDB dlopen
qqbot-loader  ───────────────────►  QQEXMiniProgram 主进程
                                         │
                                    inject.dylib
                                    uv_async → V8 主线程
                                    启动 rpc_server.js
                                         │
                                    TCP :random_port
                                         │
qqbot (Rust)  ◄──────────────────►  rpc_server.js
   │                                     │
   │  eval_js("...")            webContents.executeJavaScript()
   │                                     │
   └──────────────────────────►  游戏页面 V8 context
                                    cc.director / GameGlobal / qq
                                    Cocos Creator Scene API
```

## 前置条件

- macOS，SIP 已关闭（`csrutil disable`）
- QQ 桌面版已安装，QQ 农场小程序已打开
- Rust toolchain
- Xcode Command Line Tools（提供 `lldb`、`cc`、`codesign`）

## 使用

```bash
# 1. 打开 QQ 农场小程序

# 2. 注入（自动编译 dylib、部署到 sandbox、注入、健康检查）
cargo run -p qqbot-loader

# 3. 探索场景树（查看农场结构）
cargo run -p qqbot -- --port <端口> --explore

# 4. 自动化运行
cargo run -p qqbot -- --port <端口>
```

端口号由 `qqbot-loader` 输出，也写入 `~/Library/Containers/com.tencent.qqexminiprogram/Data/rpc_port.txt`。

## 项目结构

```
inject/
  inject.c          C dylib，一次性注入器（uv_async + V8 API）
  Makefile           编译 + 签名 + 部署到 sandbox

scripts/
  rpc_server.js      TCP RPC 服务（运行在 Electron 主进程）
  game_bridge.js     Cocos Creator 游戏 API 桥接层

crates/
  qqbot-loader/      注入加载器（编译 → 部署 → LLDB 注入 → 健康检查）
  qqbot/             自动化 bot（RPC 客户端 + 农场逻辑 + 调度器）
```

## 技术细节

**注入链路**：dylib 的 `__attribute__((constructor))` 在 dlopen 时执行，通过 `uv_async_send` 将回调调度到 V8 主线程。回调用 V8 C++ API（`Script::Compile` / `Script::Run`）执行 bootstrap JS，bootstrap 通过 `process.mainModule.require('fs')` 读取 `rpc_server.js` 并用 `vm.runInThisContext` 执行。

**RPC 协议**：每条消息 = 4 字节大端长度 + JSON。请求 `{"id":1, "js":"..."}` → 响应 `{"id":1, "ok":true, "result":...}`。

**游戏访问**：`process.mainModule.require('electron').webContents.fromId(N).executeJavaScript()` 将 JS 注入到游戏页面的 V8 context，该 context 有完整的 Cocos Creator API（`cc.director`、`cc.find`、场景节点树）。

**已验证的农场结构**：
- `FarmMapComp`：4x6 网格
- `LandComp`：24 块地（`grid_0_0` ~ `grid_3_5`）
- `PlantComp`：24 个植物槽，`gridX/gridY != -1` 表示已种植

## 与 terminal-farm 的区别

[terminal-farm](https://github.com/StringKe/terminal-farm) 通过逆向 WebSocket 协议直连服务器，需要处理 WASM 加密、设备指纹伪造、行为上报模拟。协议更新即失效。

本项目在真实 QQ 客户端内操作，所有网络通信由客户端原生处理。不涉及协议逆向、加密解密、反作弊对抗。代价是需要 macOS + SIP 关闭 + QQ 客户端运行。
