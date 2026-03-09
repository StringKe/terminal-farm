# Proxyman 抓包脚本

## FarmCodeCapture

自动捕获 QQ/微信农场小程序 WebSocket 连接中的一次性 `code`，POST 到 terminal-farm 后端完成登录，并中断客户端连接防止 code 被消费。

### 工作流程

```
手机小程序 → WebSocket gate-obt.nqf.qq.com
                ↓ Proxyman 拦截
        提取 URL 中的 code 参数
                ↓
    POST /login/code → terminal-farm 后端自动登录
                ↓
          abort() 中断客户端连接
```

### 配置

编辑 `FarmCodeCapture.js` 顶部两个常量：

```javascript
const API_BASE = "http://127.0.0.1:3000";  // 后端地址
const API_KEY = "";                          // --api-key 的值，未启用留空
```

### 安装

#### 方式一：Addon

```bash
cp proxyman/FarmCodeCapture.js ~/Library/Application\ Support/com.proxyman.NSProxy/users/
```

在 Proxyman Script Rule 中 `require("@users/FarmCodeCapture.js")`。

#### 方式二：Script Rule

1. Proxyman -> Scripting -> 新建 Script Rule
2. URL 匹配：`*gate-obt.nqf.qq.com*`
3. 粘贴 `FarmCodeCapture.js` 内容

### 使用

1. 启动 terminal-farm 并开启 API：`bun run src/main.ts --api`
2. 启动 Proxyman 并启用脚本
3. 手机打开 QQ/微信农场小程序
4. Proxyman 自动捕获 code 并 POST 到后端，账号自动上线

POST 失败时会兜底保存到 `~/Desktop/farm-code-latest.json`。
