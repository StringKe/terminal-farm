mod farm;
mod game;
mod rpc;
mod scheduler;

use anyhow::Result;
use clap::Parser;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "qqbot", about = "QQ 农场自动化机器人")]
struct Cli {
    /// RPC 端口
    #[arg(short, long)]
    port: u16,

    /// 探索模式：打印场景树后退出
    #[arg(long)]
    explore: bool,

    /// 探索深度
    #[arg(long, default_value = "3")]
    depth: u32,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env().add_directive("qqbot=info".parse()?),
        )
        .init();

    let cli = Cli::parse();
    tracing::info!("连接 RPC 端口 {}", cli.port);

    let rpc = rpc::RpcClient::connect(cli.port).await?;
    tracing::info!("RPC 连接成功");

    let game = game::GameClient::new(&rpc);
    game.inject_bridge().await?;

    if cli.explore {
        farm::explore(&game, cli.depth).await?;
    } else {
        scheduler::run(&game).await?;
    }

    Ok(())
}
