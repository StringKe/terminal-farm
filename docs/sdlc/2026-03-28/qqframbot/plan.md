# QQFramBot 实现计划

## 方案说明

CDP/Inspector 方案已废弃（Electron context isolation 阻止了 inspector 初始化）。验证通过的注入链路：

```
LLDB dlopen → dylib uv_async → V8 主线程
  → process.mainModule.require('electron')
  → webContents.fromId(4).executeJavaScript(js)
  → 游戏 V8 context（cc, GameGlobal, qq 全部可用）
```

新架构：dylib 在目标进程中启动 TCP 服务，Rust bot 连接并发送 JS 指令，dylib 通过 `executeJavaScript` 执行后返回结果。不需要 CDP、chromiumoxide。

## 改动文件

- `inject/inject.c`：重写为持久 TCP RPC 服务（接收 JS → executeJavaScript → 返回结果）
- `inject/Makefile`：添加 sign + deploy 步骤
- `crates/qqbot-loader/src/main.rs`：添加编译 dylib、复制到 sandbox、签名、注入、健康检查
- `crates/qqbot/Cargo.toml`：移除 chromiumoxide，添加 tokio（已有）
- `crates/qqbot/src/main.rs`：重写入口，连接 RPC，注入 bridge，启动调度
- `crates/qqbot/src/rpc.rs`：新增，TCP RPC 客户端
- `crates/qqbot/src/farm.rs`：实现农场操作
- `crates/qqbot/src/scheduler.rs`：实现定时调度
- `scripts/game_bridge.js`：重写为完整的游戏 API 层
- `Cargo.toml`：移除 chromiumoxide 依赖

## RPC 协议（inject.c TCP 服务）

请求：`<4 字节长度 big-endian><JSON payload>\n`
```json
{"id": 1, "js": "cc.director.getScene().name"}
```

响应：`<4 字节长度 big-endian><JSON payload>\n`
```json
{"id": 1, "ok": true, "result": "startup"}
```
或
```json
{"id": 1, "ok": false, "error": "ReferenceError: x is not defined"}
```

端口：写入 sandbox 内 `rpc_port.txt`，Rust bot 读取。

## 代码片段

### inject.c TCP 服务核心

dylib constructor 启动后：
1. `uv_tcp_init` + `uv_tcp_bind` 在 `127.0.0.1:0`（随机端口）
2. `uv_listen` 接受连接
3. 读取 JSON 请求，提取 `js` 字段
4. 在 V8 主线程用 `webContents.executeJavaScript(js)` 执行
5. Promise resolve/reject 后写回 JSON 响应
6. 端口号写入 `rpc_port.txt`

由于 executeJavaScript 返回 Promise，需要在 JS 层面处理异步：
```js
// dylib 执行的 JS（在主进程 Node context）
(async () => {
  var wc = process.mainModule.require('electron').webContents.fromId(WC_ID);
  try {
    var r = await wc.executeJavaScript(USER_JS);
    return JSON.stringify({id: ID, ok: true, result: r});
  } catch(e) {
    return JSON.stringify({id: ID, ok: false, error: e.message});
  }
})()
```

但 V8 Script::Run 是同步的。Promise 需要事件循环来 resolve。所以 dylib 发出 JS 后，结果通过 JS 回调写回 TCP socket，不是同步返回。

实际流程：
1. dylib 收到 TCP 请求 `{id:1, js:"..."}`
2. uv_async 调度到主线程
3. 主线程执行 JS：`wc.executeJavaScript(js).then(r => writeResult(connFd, id, r))`
4. JS 中 writeResult 通过 `process.mainModule.require('net')` 或全局回调写回

简化方案：不在 C 层做 TCP，改为在 JS 层做。dylib 只负责一次性注入一个 JS RPC 服务到主进程，后续通信全部走 JS 层的 TCP。

### 简化架构

```
Phase 1: dylib 注入 rpc_server.js 到主进程
  - rpc_server.js 用 Node.js net 模块开 TCP 端口
  - 接收 JSON 指令，用 webContents.executeJavaScript 执行
  - 返回 JSON 结果

Phase 2: Rust bot 连接 TCP 端口
  - 发送 JS 指令
  - 接收 JSON 结果
  - 实现自动化逻辑
```

这样 C 代码保持简单（一次性注入），复杂的 RPC 逻辑用 JS 写（在主进程有完整 Node.js API）。

## Todo List

### Phase 1: RPC 服务注入
- [x] 1.1 创建 `scripts/rpc_server.js`：Node.js TCP 服务，监听随机端口，接收 `{id, js}` JSON 请求，通过 `webContents.executeJavaScript` 执行，返回 `{id, ok, result/error}` JSON 响应。端口写入 sandbox 内 `rpc_port.txt`。webContents ID 通过遍历 `getAllWebContents()` 匹配 `out_page-frame.html` URL 自动发现。
- [x] 1.2 重写 `inject/inject.c`：简化为一次性注入器。读取 `scripts/rpc_server.js` 内容（编译时嵌入或从文件读取），在 V8 主线程通过 `process.mainModule.require('vm').runInThisContext(code)` 执行。移除 TryCatch、字符串提取等调试代码。
- [x] 1.3 更新 `inject/Makefile`：添加 `deploy` target（编译 + 签名 + 复制到 sandbox）。

### Phase 2: Loader 改造
- [x] 2.1 重写 `crates/qqbot-loader/src/main.rs`：自动编译 dylib（调用 make）、复制到 sandbox 并签名、查找 PID、LLDB 注入、等待 `rpc_port.txt` 出现并读取端口、TCP 连接健康检查（发送 `{id:0, js:"'ping'"}` 验证）。
- [x] 2.2 添加 `--build-only` flag 只编译不注入，`--port` flag 跳过注入直接连接已有 RPC。

### Phase 3: Rust RPC 客户端
- [x] 3.1 新建 `crates/qqbot/src/rpc.rs`：TCP 客户端，连接指定端口，发送 JSON 请求（length-prefixed），接收 JSON 响应，提供 `async fn eval_js(&self, js: &str) -> Result<serde_json::Value>` 接口。
- [x] 3.2 新建 `crates/qqbot/src/game.rs`：封装游戏操作的高层 API。`eval_js` 执行 game_bridge.js 中注册的函数。方法：`get_scene_info()`, `walk_nodes(path, depth)`, `find_by_component(name)`, `simulate_touch(path)`。全部返回 `serde_json::Value`。

### Phase 4: Game Bridge 重写
- [x] 4.1 重写 `scripts/game_bridge.js`：注册 `window.__qqframbot__` 对象，包含 `getSceneInfo()`, `walkNodes(path, depth)`, `findByComponent(name)`, `simulateTouch(path)`, `getGameState()`（返回农场核心状态）。每个方法返回 JSON 可序列化的结果。
- [ ] 4.2 在 `game_bridge.js` 中添加 `getGameState()`：通过遍历 Cocos Creator 场景树，提取地块列表、作物状态、背包物品。具体结构需要在注入后实际探索场景树来确定。

### Phase 5: 主程序和调度
- [x] 5.1 重写 `crates/qqbot/src/main.rs`：解析 CLI 参数（`--port` RPC 端口），初始化 RPC 客户端，注入 game_bridge.js，根据模式启动探索或自动化。
- [x] 5.2 实现 `crates/qqbot/src/farm.rs`：`explore()` 打印场景树结构（用于开发调试），`auto_farm()` 循环检查地块状态并执行操作。
- [x] 5.3 实现 `crates/qqbot/src/scheduler.rs`：简单的 loop + sleep 调度，操作间随机延迟 1-3 秒，每轮间隔 30-60 秒。
- [x] 5.4 更新 `Cargo.toml`：移除 `chromiumoxide` 依赖。

### Phase 6: 端到端验证
- [ ] 6.1 端到端测试：`cargo run -p qqbot-loader` 自动注入 → `cargo run -p qqbot -- --explore` 探索场景树 → 确认能读取到游戏状态。
