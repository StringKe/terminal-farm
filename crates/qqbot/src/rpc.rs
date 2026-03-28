use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::Mutex;

pub struct RpcClient {
    stream: Mutex<TcpStream>,
    next_id: AtomicU64,
}

impl RpcClient {
    pub async fn connect(port: u16) -> Result<Self> {
        let stream = TcpStream::connect(format!("127.0.0.1:{}", port))
            .await
            .with_context(|| format!("连接 RPC 端口 {} 失败", port))?;

        Ok(Self {
            stream: Mutex::new(stream),
            next_id: AtomicU64::new(1),
        })
    }

    pub async fn eval_js(&self, js: &str) -> Result<Value> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let req = serde_json::json!({ "id": id, "js": js });
        let body = serde_json::to_vec(&req)?;

        let mut stream = self.stream.lock().await;

        // 发送: 4 字节长度 + JSON
        stream.write_all(&(body.len() as u32).to_be_bytes()).await?;
        stream.write_all(&body).await?;
        stream.flush().await?;

        // 接收: 4 字节长度 + JSON
        let mut header = [0u8; 4];
        stream.read_exact(&mut header).await?;
        let len = u32::from_be_bytes(header) as usize;

        let mut buf = vec![0u8; len];
        stream.read_exact(&mut buf).await?;

        let resp: Value = serde_json::from_slice(&buf)
            .context("RPC 响应不是有效 JSON")?;

        if resp["ok"] == true {
            Ok(resp["result"].clone())
        } else {
            bail!("JS 执行失败: {}", resp["error"]);
        }
    }

    /// 在游戏页面执行 JS 并返回 JSON 字符串的解析结果
    pub async fn eval_game_js(&self, js: &str) -> Result<Value> {
        // 包装为 JSON.stringify 以确保复杂对象能传回
        let wrapped = format!(
            "JSON.stringify((function() {{ {} }})())",
            js
        );
        let result = self.eval_js(&wrapped).await?;
        match result.as_str() {
            Some(s) => serde_json::from_str(s).context("解析游戏 JS 结果失败"),
            None => Ok(result),
        }
    }
}
