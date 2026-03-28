use anyhow::{bail, Context, Result};
use clap::Parser;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;

const PROCESS_NAME: &str = "QQEXMiniProgram";
const SANDBOX: &str =
    "/Users/chen/Library/Containers/com.tencent.qqexminiprogram/Data";

#[derive(Parser)]
#[command(name = "qqbot-loader", about = "注入 RPC 服务到 QQEXMiniProgram")]
struct Cli {
    /// 只编译 dylib，不注入
    #[arg(long)]
    build_only: bool,

    /// 跳过注入，直接检查已有 RPC 端口
    #[arg(long)]
    port: Option<u16>,

    /// 目标进程 PID（默认自动查找）
    #[arg(short, long)]
    pid: Option<u32>,
}

fn find_pid(name: &str) -> Result<u32> {
    let output = Command::new("pgrep")
        .args(["-x", name])
        .output()
        .context("pgrep 执行失败")?;

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .and_then(|l| l.trim().parse().ok())
        .ok_or_else(|| anyhow::anyhow!("未找到 {} 进程，请先打开 QQ 农场小程序", name))
}

fn build_and_deploy() -> Result<()> {
    println!("[loader] 编译 inject.dylib...");
    let status = Command::new("make")
        .arg("deploy")
        .current_dir("inject")
        .status()
        .context("make deploy 失败")?;
    if !status.success() {
        bail!("make deploy 退出码 {}", status);
    }
    println!("[loader] 编译部署完成");
    Ok(())
}

fn inject(pid: u32) -> Result<()> {
    let dylib = format!("{}/inject.dylib", SANDBOX);
    println!("[loader] 注入 PID {} ...", pid);

    let expr = format!(r#"expr (void*)dlopen("{}", 2)"#, dylib);
    let output = Command::new("lldb")
        .args(["-p", &pid.to_string(), "-o", &expr, "-o", "detach", "-o", "quit"])
        .output()
        .context("lldb 执行失败")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.contains("= 0x0000000000000000") || stdout.contains("= nil") {
        // 获取 dlerror
        let expr2 = format!(
            r#"expr (void*)dlopen("{}", 2)"#, dylib
        );
        let output2 = Command::new("lldb")
            .args(["-p", &pid.to_string(), "-o", &expr2,
                   "-o", r#"expr (const char*)dlerror()"#,
                   "-o", "detach", "-o", "quit"])
            .output()?;
        let stdout2 = String::from_utf8_lossy(&output2.stdout);
        bail!("dlopen 返回 NULL:\n{}", stdout2);
    }

    println!("[loader] dlopen 成功");
    Ok(())
}

fn wait_for_port() -> Result<u16> {
    let port_file = format!("{}/rpc_port.txt", SANDBOX);
    println!("[loader] 等待 RPC 端口...");

    for _ in 0..30 {
        if let Ok(content) = std::fs::read_to_string(&port_file) {
            if let Ok(port) = content.trim().parse::<u16>() {
                return Ok(port);
            }
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    bail!("超时：rpc_port.txt 未出现（6 秒）");
}

fn health_check(port: u16) -> Result<()> {
    println!("[loader] 健康检查 127.0.0.1:{} ...", port);

    let mut stream = TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse()?,
        Duration::from_secs(3),
    )
    .context("TCP 连接失败")?;

    stream.set_read_timeout(Some(Duration::from_secs(5)))?;

    // 发送 ping
    let req = br#"{"id":0,"js":"'pong'"}"#;
    let mut msg = Vec::with_capacity(4 + req.len());
    msg.extend_from_slice(&(req.len() as u32).to_be_bytes());
    msg.extend_from_slice(req);
    stream.write_all(&msg)?;

    // 接收响应
    let mut header = [0u8; 4];
    stream.read_exact(&mut header)?;
    let len = u32::from_be_bytes(header) as usize;
    let mut body = vec![0u8; len];
    stream.read_exact(&mut body)?;

    let resp: serde_json::Value = serde_json::from_slice(&body)?;
    if resp["ok"] == true && resp["result"] == "pong" {
        println!("[loader] 健康检查通过");
        Ok(())
    } else {
        bail!("健康检查失败: {}", resp);
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    if let Some(port) = cli.port {
        health_check(port)?;
        println!("[loader] RPC 服务已就绪，端口 {}", port);
        return Ok(());
    }

    build_and_deploy()?;

    if cli.build_only {
        println!("[loader] 仅编译模式，不注入");
        return Ok(());
    }

    // 清理旧的端口文件
    let port_file = format!("{}/rpc_port.txt", SANDBOX);
    let _ = std::fs::remove_file(&port_file);

    let pid = match cli.pid {
        Some(p) => p,
        None => find_pid(PROCESS_NAME)?,
    };

    inject(pid)?;

    let port = wait_for_port()?;
    health_check(port)?;

    println!("\n[loader] 注入成功！RPC 端口: {}", port);
    println!("[loader] 运行 bot: cargo run -p qqbot -- --port {}", port);
    Ok(())
}
