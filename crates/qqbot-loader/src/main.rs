use anyhow::{bail, Context, Result};
use clap::Parser;
use std::path::PathBuf;
use std::process::Command;

const PROCESS_NAME: &str = "QQEXMiniProgram";
const DEFAULT_DYLIB: &str = "inject/inject.dylib";

#[derive(Parser)]
#[command(name = "qqbot-loader", about = "注入 inspector dylib 到 QQEXMiniProgram")]
struct Cli {
    /// dylib 路径（默认: inject/inject.dylib）
    #[arg(short, long)]
    dylib: Option<PathBuf>,

    /// 目标进程 PID（默认自动查找）
    #[arg(short, long)]
    pid: Option<u32>,

    /// inspector 端口（默认 9229）
    #[arg(long, default_value = "9229")]
    port: u16,
}

fn find_pid(name: &str) -> Result<u32> {
    let output = Command::new("pgrep")
        .args(["-x", name])
        .output()
        .context("pgrep 执行失败")?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let pid = stdout
        .lines()
        .next()
        .and_then(|line| line.trim().parse::<u32>().ok());

    match pid {
        Some(p) => Ok(p),
        None => bail!("未找到 {} 进程，请先打开 QQ 农场小程序", name),
    }
}

fn inject(pid: u32, dylib_path: &str) -> Result<()> {
    let dylib_abs = std::fs::canonicalize(dylib_path)
        .with_context(|| format!("dylib 不存在: {}", dylib_path))?;

    let dylib_str = dylib_abs.to_string_lossy();

    println!("[loader] 目标进程 PID: {}", pid);
    println!("[loader] 注入 dylib: {}", dylib_str);

    let expr = format!(r#"expr (void*)dlopen("{}", 2)"#, dylib_str);

    let output = Command::new("lldb")
        .args([
            "-p",
            &pid.to_string(),
            "-o",
            &expr,
            "-o",
            "detach",
            "-o",
            "quit",
        ])
        .output()
        .context("lldb 执行失败")?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);

    if !output.status.success() {
        bail!(
            "lldb 注入失败 (exit={}):\nstdout: {}\nstderr: {}",
            output.status,
            stdout,
            stderr
        );
    }

    // 检查 dlopen 返回值
    if stdout.contains("= 0x0000000000000000") || stdout.contains("= nil") {
        bail!("dlopen 返回 NULL，dylib 加载失败。检查 stderr:\n{}", stderr);
    }

    println!("[loader] 注入成功");
    println!("[loader] inspector 应已在 ws://127.0.0.1:9229 开放");
    Ok(())
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    let pid = match cli.pid {
        Some(p) => p,
        None => find_pid(PROCESS_NAME)?,
    };

    let dylib_path = cli
        .dylib
        .unwrap_or_else(|| PathBuf::from(DEFAULT_DYLIB));

    inject(pid, &dylib_path.to_string_lossy())?;

    Ok(())
}
