---
name: browser-use
description: "使用外部 browser-use-cli 执行浏览器自动化任务。适合快速网页抓取、表单填写和临时导航任务。需要当前 runtime 环境已安装 browser-use-cli。"
metadata: { "openclaw": { "emoji": "🌐", "requires": { "anyBins": ["browser-use-cli"] } } }
---

# Browser-Use 浏览器自动化

使用外部 `browser-use-cli` 控制浏览器执行自动化任务。

定位说明：

- 这是一个外部 CLI wrapper，不是 OpenClaw 内置浏览器 runtime
- 通用浏览器 runtime / 网关能力优先使用内置 `browser` 插件
- 需要稳定的站点登录、OTP、auth-state 诊断时，优先考虑 `superBrower`

## 功能

- 🌐 网页抓取和数据提取
- 📝 自动填写表单
- 🔍 网站操作和导航
- 📸 截图和内容获取
- 🔐 登录操作

## 使用方式

### Bash 工具调用

```bash
browser-use-cli "你的任务描述"
```

### 指定模型

```bash
# 使用 MiniMax
browser-use-cli "访问百度搜索 OpenClaw" -m minimax

# 使用 GLM-4.7
browser-use-cli "访问淘宝搜索商品" -m glm
```

## 示例任务

### 网页搜索和信息提取

```bash
browser-use-cli "访问百度，搜索'OpenClaw'，获取第一条搜索结果的标题和链接"
```

### 表单填写

```bash
browser-use-cli "打开某网站的联系表单，填写姓名为'张三'，邮箱为'test@example.com'，提交表单"
```

### 登录操作

```bash
browser-use-cli "打开 GitHub 登录页面，输入用户名和密码（从环境变量获取），完成登录"
```

### 数据抓取

```bash
browser-use-cli "访问某电商网站，搜索'笔记本电脑'，获取前5个商品的价格和名称"
```

## 返回格式

命令返回 JSON 格式：

```json
{
  "success": true,
  "result": "任务执行结果..."
}
```

失败时：

```json
{
  "success": false,
  "error": "错误信息",
  "traceback": "详细堆栈..."
}
```

## 注意事项

1. **runtime 依赖**: 仅在已安装 `browser-use-cli` 的运行环境可用
2. **Headless 模式**: 浏览器通常在无头模式下运行
3. **步骤限制**: 默认适合短任务，不适合长链路稳定编排
4. **职责边界**: 需要可复用站点 profile、OTP 或登录诊断时，优先使用 `superBrower`

## 模型选择

| 模型    | 优点               | 缺点         |
| ------- | ------------------ | ------------ |
| MiniMax | 推荐默认、支持视觉 | 依赖环境配置 |
| GLM-4.7 | 备选方案           | 不支持视觉   |

## 故障排查

### 命令不存在

```bash
which browser-use-cli
# 应该返回: /usr/local/bin/browser-use-cli
```

### Chrome 未安装

```bash
ls "${HOME}/.cache/puppeteer/chrome/"
```

### Python 环境问题

```bash
/opt/browser-use-venv/bin/python3 -c "from browser_use import Agent; print('OK')"
```

## 相关文档

- [Browser-Use Patches](/scripts/browser-use-patches/README.md) - 中文 LLM 兼容性补丁
- [Browser Tool](/docs/tools/browser.md) - OpenClaw 内置浏览器工具
