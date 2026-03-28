use anyhow::Result;

use crate::game::GameClient;

/// 探索模式：打印场景树结构
pub async fn explore(game: &GameClient<'_>, depth: u32) -> Result<()> {
    tracing::info!("探索模式，深度 {}", depth);

    let scene = game.get_scene_info().await?;
    tracing::info!("场景: {}", serde_json::to_string_pretty(&scene)?);

    let tree = game.walk_nodes(None, depth).await?;
    println!("{}", serde_json::to_string_pretty(&tree)?);

    let state = game.get_game_state().await?;
    tracing::info!(
        "农场节点数: {}",
        state["farmNodes"]
            .as_array()
            .map(|a| a.len())
            .unwrap_or(0)
    );
    if let Some(nodes) = state["farmNodes"].as_array() {
        for node in nodes {
            println!(
                "  {} [{}] {:?}",
                node["path"], node["comp"], node["data"]
            );
        }
    }

    Ok(())
}
