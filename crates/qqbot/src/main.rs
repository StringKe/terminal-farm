mod cdp;
mod farm;
mod scheduler;

use anyhow::Result;
use clap::Parser;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "qqbot", about = "QQ 农场自动化机器人")]
struct Cli {
    /// inspector WebSocket 地址
    #[arg(long, default_value = "ws://127.0.0.1:9229")]
    ws: String,

    /// 是否只探索场景（不执行操作）
    #[arg(long)]
    explore: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("qqbot=info".parse()?))
        .init();

    let cli = Cli::parse();
    tracing::info!("连接 inspector: {}", cli.ws);

    // TODO: 连接 CDP，注入 game_bridge.js，启动自动化
    tracing::info!("QQBot 启动完成");

    Ok(())
}
