use anyhow::Result;
use rand::Rng;
use std::time::Duration;

use crate::game::GameClient;

/// 主自动化循环
pub async fn run(game: &GameClient<'_>) -> Result<()> {
    tracing::info!("自动化模式启动");

    loop {
        match tick(game).await {
            Ok(_) => {}
            Err(e) => {
                tracing::error!("tick 失败: {}", e);
            }
        }

        let delay = rand::thread_rng().gen_range(30..=60);
        tracing::info!("下次检查在 {} 秒后", delay);
        tokio::time::sleep(Duration::from_secs(delay)).await;
    }
}

async fn tick(game: &GameClient<'_>) -> Result<()> {
    let state = game.get_game_state().await?;
    let scene = state["scene"].as_str().unwrap_or("unknown");
    tracing::info!("当前场景: {}", scene);

    let farm_nodes = state["farmNodes"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    tracing::info!("发现 {} 个农场节点", farm_nodes);

    // TODO: 根据场景树结构实现具体操作
    // 需要先用 explore 模式了解节点结构

    random_delay().await;
    Ok(())
}

async fn random_delay() {
    let ms = rand::thread_rng().gen_range(1000..=3000);
    tokio::time::sleep(Duration::from_millis(ms)).await;
}
