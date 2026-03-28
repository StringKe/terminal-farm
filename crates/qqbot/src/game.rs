use anyhow::Result;
use serde_json::Value;

use crate::rpc::RpcClient;

const GAME_BRIDGE_JS: &str = include_str!("../../../scripts/game_bridge.js");

pub struct GameClient<'a> {
    rpc: &'a RpcClient,
}

impl<'a> GameClient<'a> {
    pub fn new(rpc: &'a RpcClient) -> Self {
        Self { rpc }
    }

    /// 注入 game_bridge.js 到游戏页面
    pub async fn inject_bridge(&self) -> Result<()> {
        self.rpc.eval_js(GAME_BRIDGE_JS).await?;
        tracing::info!("game_bridge.js 注入成功");
        Ok(())
    }

    /// 获取当前场景信息
    pub async fn get_scene_info(&self) -> Result<Value> {
        self.rpc
            .eval_game_js("return window.__qqframbot__.getSceneInfo()")
            .await
    }

    /// 遍历节点树
    pub async fn walk_nodes(&self, path: Option<&str>, max_depth: u32) -> Result<Value> {
        let path_arg = path.map(|p| format!("'{}'", p)).unwrap_or("null".into());
        self.rpc
            .eval_game_js(&format!(
                "return window.__qqframbot__.walkNodes({}, {})",
                path_arg, max_depth
            ))
            .await
    }

    /// 按组件名查找节点
    pub async fn find_by_component(&self, name: &str) -> Result<Value> {
        self.rpc
            .eval_game_js(&format!(
                "return window.__qqframbot__.findByComponent('{}')",
                name
            ))
            .await
    }

    /// 获取游戏状态
    pub async fn get_game_state(&self) -> Result<Value> {
        self.rpc
            .eval_game_js("return window.__qqframbot__.getGameState()")
            .await
    }

    /// 执行任意游戏 JS
    pub async fn eval(&self, js: &str) -> Result<Value> {
        self.rpc.eval_game_js(&format!("return {}", js)).await
    }
}
