读取 `.parent-commit` 中记录的旧仓库最后同步 commit hash。

然后在旧仓库路径 `$ARGUMENTS` 中执行：
```
git -C $ARGUMENTS log <hash>..HEAD --oneline
```

对于每个新 commit：
1. 使用 `git -C $ARGUMENTS diff <prev_hash>..<hash>` 读取变更
2. **理解其变更意图**（新功能 / 修复 / 配置变更 / 重构）
3. 在 terminal-farm 的 TypeScript 代码中找到对应模块
4. 用新架构的风格（TypeScript + ESM + Ink）实现等价变更
5. 生成 conventional commit（feat/fix/refactor 等）

全部处理完后，更新 `.parent-commit` 为旧仓库最新的 commit hash。

注意：
- 这是**逻辑级别**同步，不是盲目 patch
- 旧代码是 CommonJS + console.log，新代码是 TypeScript + ESM + Ink UI
- 每个变更都要在新架构中找到正确位置实现
