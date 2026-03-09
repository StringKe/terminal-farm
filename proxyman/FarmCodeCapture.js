/// 自动抓取 QQ 农场 WebSocket 连接中的 code 参数，POST 到 terminal-farm 后端并中断客户端连接
///
/// Script Rule URL 匹配: *gate-obt.nqf.qq.com*

// terminal-farm API 地址
const API_BASE = "http://127.0.0.1:3000";
// 如果启用了 --api-key，填写对应的值；未启用则留空
const API_KEY = "";

async function onRequest(context, url, request) {
  var code = request.queries["code"];
  if (!code || code.length === 0) {
    console.log("[FarmCodeCapture] 连接无 code 参数，跳过");
    return request;
  }

  var platform = request.queries["platform"] || "qq";
  var timestamp = new Date().toISOString();

  console.log("========================================");
  console.log("[FarmCodeCapture] 捕获到 code: " + code);
  console.log("[FarmCodeCapture] platform: " + platform);
  console.log("[FarmCodeCapture] time: " + timestamp);
  console.log("========================================");

  // POST 到 terminal-farm 后端自动登录
  try {
    var headers = { "Content-Type": "application/json" };
    if (API_KEY) {
      headers["Authorization"] = "Bearer " + API_KEY;
    }

    var result = await $http.post(API_BASE + "/login/code", {
      body: JSON.stringify({ platform: platform, code: code }),
      headers: headers,
    });

    console.log("[FarmCodeCapture] 后端响应: " + JSON.stringify(result.body));
  } catch (e) {
    console.log("[FarmCodeCapture] POST 失败: " + e);
    writeToFile(JSON.stringify({ code: code, platform: platform, capturedAt: timestamp }), "~/Desktop/farm-code-latest.json");
    console.log("[FarmCodeCapture] 已保存到 ~/Desktop/farm-code-latest.json");
  }

  // 中断客户端连接，防止 code 被消费
  abort();
}

async function onResponse(context, url, request, response) {
  return response;
}
