# OpenClaw 代码分层与仓库规划

## 目标

1. **Core 层**：通过 upstream 获取 OpenClaw 官方最新版本
2. **Overlay 层**：保留团队私有扩展、技能、配置
3. **断开 Gitee**：移除 gitee 远程仓库依赖

---

## 一、当前 Git 仓库状态

### 1.1 远程仓库配置

```
origin    → git@gitee.com:ppsmart/smart-openclaw.git (Gitee 私有仓库)
github    → https://github.com/sandro626/openclaw.git (GitHub fork)
upstream  → https://github.com/openclaw/openclaw.git (官方仓库)
```

### 1.2 版本差距分析

| 项目               | 状态            |
| ------------------ | --------------- |
| upstream/main 领先 | **7299 个提交** |
| 本地自定义提交     | **20+ 个**      |
| 本地版本           | 2026.2.25       |
| upstream 版本      | 2026.3.9+       |

### 1.3 本地自定义提交清单

```
3436fca4d feat: add superBrower browser automation extension
506f9f6c4 feat: add zentao plugin and skill
43a04d1e1 docs: 更新 browser-use 补丁文档
04e079afb feat: add gateway error notification via webhook
18b1fc2b6 fix: update MiniMax patch with JSON extraction
dbef00380 feat: add browser-use patches for Chinese LLM
02b5571f4 docs: add server operations and agent memory protection
17432e31e docs: add deployment protection guide
0f5ac9169 feat: 添加飞书 OSS 存储支持和 UI 登录模态框
e3d4c1f78 feat(feishu): 添加个人账号 OAuth 2.0 授权支持
5cf16b11a fix(wecom): 支持 OSS 存储和本地文件路径
fce8e06d03 fix(wecom): route encrypted robot callbacks
ceb5bf8409 feat: 升级到上游 openclaw 2026.2.25 并保留本地扩展
```

---

## 二、分层架构规划

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: Core (上游)                       │
│            来源: upstream/openclaw/openclaw                  │
│                   自动升级，不做修改                          │
├─────────────────────────────────────────────────────────────┤
│  src/               # 核心源码                               │
│  dist/              # 构建产物                               │
│  extensions/        # 官方扩展 (通用)                        │
│  skills/            # 官方技能 (通用)                        │
│  docs/              # 官方文档                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Layer 2: Overlay (私有)                       │
│            来源: 本地开发 + 服务器同步                        │
│                   独立维护，不随上游更新                       │
├─────────────────────────────────────────────────────────────┤
│  overlay/                                                     │
│  ├── extensions/                                              │
│  │   ├── feishu/          # 飞书扩展 (业务定制)              │
│  │   ├── wecom/           # 企业微信扩展 (业务定制)          │
│  │   ├── mysql-readonly/  # MySQL 只读扩展                  │
│  │   ├── superBrower/     # 超级浏览器扩展                   │
│  │   └── zentao/          # 禅道扩展                        │
│  ├── skills/                                                  │
│  │   ├── browser-use/     # 浏览器自动化技能                │
│  │   ├── dev-openclaw/    # 开发助手技能                    │
│  │   ├── mysql-readonly/  # 数据库技能                      │
│  │   ├── superBrower/     # 浏览器技能                      │
│  │   ├── zentao/          # 禅道技能                        │
│  │   ├── feishu-suite/    # 飞书相关技能组 (从服务器同步)   │
│  │   └── ops-workflows/   # 运维工作流 (从服务器同步)       │
│  ├── agents/                                                  │
│  │   ├── main/            # 主助手定义                       │
│  │   ├── dev/             # 开发工程师                       │
│  │   ├── tester/          # 测试工程师                       │
│  │   ├── ops/             # 运维工程师                       │
│  │   ├── cto/             # CTO助手                          │
│  │   └── pc-*/            # 专业角色 agent                   │
│  └── patches/                                                 │
│      └── browser-use/     # 第三方补丁                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Layer 3: Runtime (运行态)                       │
│            来源: 服务器 101.35.218.139                        │
│                   永不入库，只备份                            │
├─────────────────────────────────────────────────────────────┤
│  ~/.openclaw/                                                 │
│  ├── openclaw.json          # 运行配置 (含密钥)              │
│  ├── agents/*/sessions/     # 会话数据 ⚠️ 保护              │
│  ├── workspace/*/memory/    # 记忆数据 ⚠️ 保护              │
│  └── memory/*.sqlite        # 记忆索引 ⚠️ 保护              │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、私有资产清单

### 3.1 私有扩展 (extensions/)

| 扩展名           | 说明           | 来源                | 迁移目标                          |
| ---------------- | -------------- | ------------------- | --------------------------------- |
| `feishu`         | 飞书消息通道   | 本地开发 + 上游合并 | overlay/extensions/feishu         |
| `wecom`          | 企业微信通道   | 本地开发            | overlay/extensions/wecom          |
| `mysql-readonly` | MySQL 只读工具 | 本地开发            | overlay/extensions/mysql-readonly |
| `superBrower`    | 浏览器自动化   | 本地开发            | overlay/extensions/superBrower    |
| `zentao`         | 禅道集成       | 本地开发            | overlay/extensions/zentao         |

### 3.2 私有技能 (skills/)

| 技能名           | 说明              | 来源     |
| ---------------- | ----------------- | -------- |
| `browser-use`    | 浏览器自动化      | 本地开发 |
| `dev-openclaw`   | OpenClaw 开发助手 | 本地开发 |
| `mysql-readonly` | 数据库查询        | 本地开发 |
| `superBrower`    | 超级浏览器        | 本地开发 |
| `zentao`         | 禅道集成          | 本地开发 |

### 3.3 服务器独有技能 (需同步到本地)

从服务器 101.35.218.139 同步到 overlay/skills/：

| 技能组           | 技能列表                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **飞书套件**     | feishu-contacts, feishu-doc-guide, feishu-doc-manager, lark-integration, dingtalk-feishu-cn |
| **记忆系统**     | memory, memory-lite, hippocampus-memory                                                     |
| **主动代理**     | proactive-agent, self-improving-agent, agent-council, agent-orchestrator                    |
| **自动化工作流** | automation-workflows                                                                        |
| **阿里云**       | aliyun-oss-upload                                                                           |
| **搜索**         | tavily-search                                                                               |
| **禅道**         | chandao                                                                                     |
| **测试/办公**    | ppt-creator, manage-platform-test, weather-cn, tecent-finance                               |
| **第三方整包**   | bankr, base, botchan, clanker, endaoment, neynar, onchainkit 等                             |

### 3.4 Agent 定义

从 `server-config/agents/` 迁移到 `overlay/agents/`：

```
main, cto, dev, tester, ops
pc-backend, pc-frontend, pc-devops
pc-ceo_assistant, pc-code_reviewer, pc-pctester
pc-ip_expert, pc-pm, pctester
```

---

## 四、Git 仓库重构方案

### 方案 A：单仓库 + 分支策略 (推荐)

```
main              → 追踪 upstream/main (纯净核心)
├── overlay/      → 私有资产目录
└── .gitignore    → 忽略运行态文件
```

**优点**：

- 简单直接
- 升级方便：`git merge upstream/main`
- 私有资产与核心在同一仓库

**实施步骤**：

1. **创建 overlay 分支结构**
2. **迁移私有资产到 overlay/**
3. **重置 main 到 upstream/main**
4. **合并 overlay 目录**

### 方案 B：双仓库策略

```
openclaw-core     → 追踪 upstream (只读)
openclaw-overlay  → 私有资产仓库
```

**优点**：

- 核心与私有完全分离
- 升级无冲突

**缺点**：

- 需要维护两个仓库
- 部署时需要合并

---

## 五、断开 Gitee 方案

### 5.1 当前状态

```
origin → gitee.com:ppsmart/smart-openclaw.git (主推送目标)
```

### 5.2 重构后状态

```
origin      → github.com:sandro626/openclaw.git (主推送目标)
upstream    → github.com/openclaw/openclaw.git (只读，用于同步)
```

### 5.3 执行步骤

```bash
# 1. 移除 gitee 远程
git remote remove origin

# 2. 设置 github 为新的 origin
git remote rename github origin

# 3. 验证配置
git remote -v
# origin    → github.com:sandro626/openclaw.git
# upstream  → github.com/openclaw/openclaw.git
```

---

## 六、实施计划

### Phase 1: 准备工作 (Day 1)

- [ ] 备份当前仓库
- [ ] 创建 overlay/ 目录结构
- [ ] 列出所有私有资产清单

### Phase 2: 私有资产迁移 (Day 2-3)

- [ ] 迁移 extensions/feishu → overlay/extensions/feishu
- [ ] 迁移 extensions/wecom → overlay/extensions/wecom
- [ ] 迁移 extensions/mysql-readonly → overlay/extensions/mysql-readonly
- [ ] 迁移 extensions/superBrower → overlay/extensions/superBrower
- [ ] 迁移 extensions/zentao → overlay/extensions/zentao
- [ ] 迁移私有 skills → overlay/skills/
- [ ] 迁移 server-config/agents → overlay/agents/

### Phase 3: 从服务器同步资产 (Day 3-4)

- [ ] 同步服务器 skills 到 overlay/skills/
- [ ] 同步服务器配置模板到 runtime-templates/
- [ ] 验证 agent 定义完整性

### Phase 4: 仓库重构 (Day 4)

- [ ] 重置 main 到 upstream/main
- [ ] 合并 overlay 目录
- [ ] 移除 gitee 远程
- [ ] 推送到新的 origin

### Phase 5: 验证与部署 (Day 5)

- [ ] 本地构建测试
- [ ] 部署到服务器
- [ ] 验证功能正常
- [ ] 解决 memory 目录问题

---

## 七、升级流程（重构后）

```bash
# 1. 获取上游更新
git fetch upstream

# 2. 合并到本地 (只更新 core，不覆盖 overlay)
git merge upstream/main

# 3. 解决可能的 overlay 冲突
# (如果有)

# 4. 构建测试
pnpm build && pnpm test

# 5. 部署
rsync -av dist/ server:/home/ubuntu/projects/openclaw/dist/
rsync -av overlay/ server:/home/ubuntu/projects/openclaw/overlay/

# 6. 重启 gateway
ssh server "pkill -f openclaw-gateway; nohup openclaw gateway run ..."
```

---

## 八、风险与注意事项

### 8.1 高风险操作

| 操作          | 风险         | 缓解措施              |
| ------------- | ------------ | --------------------- |
| 重置 main     | 丢失本地提交 | 先备份到单独分支      |
| 部署时覆盖    | 丢失运行态   | 使用 `--exclude` 保护 |
| 合并 upstream | 冲突         | 分步骤合并，仔细检查  |

### 8.2 保护目录（永不覆盖）

```
~/.openclaw/agents/*/sessions/
~/.openclaw/workspace/*/memory/
~/.openclaw/memory/*.sqlite
```

### 8.3 回滚方案

如果重构失败：

```bash
# 恢复到重构前状态
git checkout <backup-branch>
# 或从备份恢复
git reset --hard <backup-commit>
```

---

## 九、后续维护

### 定期任务

- **每周**：检查 upstream 更新
- **每月**：同步服务器新增资产到本地
- **每季度**：审查 overlay 资产，清理无用内容

### 文档更新

- 更新 docs/operations/ 系列文档
- 维护 overlay/README.md
- 更新部署脚本
