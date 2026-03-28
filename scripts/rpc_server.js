/**
 * QQFramBot RPC Server
 *
 * 运行在 QQEXMiniProgram 主进程的 Node.js context 中。
 * 由 inject.dylib 一次性注入。
 *
 * 功能：
 * - TCP 监听随机端口
 * - 接收 JSON 请求 {id, js}
 * - 通过 webContents.executeJavaScript 在游戏页面执行 JS
 * - 返回 JSON 响应 {id, ok, result/error}
 *
 * 协议：每条消息 = 4 字节大端长度 + JSON 字节
 */
(function () {
  'use strict';
  if (global.__qqframbot_rpc__) return;
  global.__qqframbot_rpc__ = true;

  var net = process.mainModule.require('net');
  var fs = process.mainModule.require('fs');
  var electron = process.mainModule.require('electron');

  var SANDBOX = '/Users/chen/Library/Containers/com.tencent.qqexminiprogram/Data';
  var PORT_FILE = SANDBOX + '/rpc_port.txt';
  var LOG_FILE = SANDBOX + '/rpc_server.log';

  function log(msg) {
    var line = new Date().toISOString() + ' ' + msg + '\n';
    try { fs.appendFileSync(LOG_FILE, line); } catch (e) {}
  }

  /** 查找游戏页面的 webContents（URL 包含 out_page-frame.html） */
  function findGameWebContents() {
    var all = electron.webContents.getAllWebContents();
    for (var i = 0; i < all.length; i++) {
      var url = all[i].getURL();
      if (url.indexOf('out_page-frame.html') >= 0) return all[i];
    }
    return null;
  }

  /** 写入带长度前缀的消息到 socket */
  function writeMessage(socket, obj) {
    var json = JSON.stringify(obj);
    var body = Buffer.from(json, 'utf8');
    var header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    socket.write(Buffer.concat([header, body]));
  }

  /** 处理单个请求 */
  function handleRequest(socket, msg) {
    var id = msg.id || 0;
    var js = msg.js;

    if (!js) {
      writeMessage(socket, { id: id, ok: false, error: 'missing js field' });
      return;
    }

    var wc = findGameWebContents();
    if (!wc) {
      writeMessage(socket, { id: id, ok: false, error: 'game webContents not found' });
      return;
    }

    wc.executeJavaScript(js, true)
      .then(function (result) {
        writeMessage(socket, { id: id, ok: true, result: result });
      })
      .catch(function (err) {
        writeMessage(socket, { id: id, ok: false, error: err.message || String(err) });
      });
  }

  /** 创建 TCP 服务 */
  var server = net.createServer(function (socket) {
    log('client connected');
    var buffer = Buffer.alloc(0);

    socket.on('data', function (chunk) {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 4) {
        var msgLen = buffer.readUInt32BE(0);
        if (buffer.length < 4 + msgLen) break;

        var jsonBuf = buffer.slice(4, 4 + msgLen);
        buffer = buffer.slice(4 + msgLen);

        try {
          var msg = JSON.parse(jsonBuf.toString('utf8'));
          handleRequest(socket, msg);
        } catch (e) {
          writeMessage(socket, { id: 0, ok: false, error: 'invalid JSON: ' + e.message });
        }
      }
    });

    socket.on('error', function (err) {
      log('socket error: ' + err.message);
    });

    socket.on('close', function () {
      log('client disconnected');
    });
  });

  server.listen(0, '127.0.0.1', function () {
    var port = server.address().port;
    log('RPC server listening on port ' + port);
    try { fs.writeFileSync(PORT_FILE, String(port)); } catch (e) { log('write port file failed: ' + e.message); }
  });

  server.on('error', function (err) {
    log('server error: ' + err.message);
  });

  log('rpc_server.js loaded');
})();
