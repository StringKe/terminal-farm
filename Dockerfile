FROM oven/bun:1 AS base
WORKDIR /app

# 安装依赖
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# 复制源码和配置
COPY src/ src/
COPY proto/ proto/
COPY game-config/ game-config/
COPY .version.json ./

# 数据目录
RUN mkdir -p data

EXPOSE 3000

# 默认 headless 模式，API 绑定 0.0.0.0
ENTRYPOINT ["bun", "run", "src/main.ts", "--headless", "--api-host", "0.0.0.0"]
# 用户通过 CMD 或 docker run 追加参数: --code xxx --api-key xxx --api-port 3000
CMD []
