# 飞书文档操作指南技能

## 技能简介

总结飞书文档操作的最佳实践、注意事项和常见问题解决方案。

## 适用场景

此技能适用于以下场景：

1. **首次接触飞书文档API**
   - 了解不同操作方法的区别
   - 避免常见错误
   - 快速上手文档操作

2. **日常文档维护**
   - 更新现有文档
   - 创建新文档
   - 追加内容

3. **故障排除**
   - 解决 400 错误
   - 调试文档操作
   - 优化操作流程

## 核心经验

### 1. 操作方法选择

**创建新文档：** 使用 `create`

```bash
feishu_doc action=create title="标题" content="内容"
```

**更新现有文档：** 使用 `update_block`

```bash
feishu_doc action=update_block \
    doc_token=xxx \
    block_id=xxx \
    content="新内容"
```

**完全替换：** 使用 `write`（慎用）

```bash
feishu_doc action=write doc_token=xxx content="全新内容"
```

### 2. 400 错误的真正原因

**常见误区：**

- ❌ 以为是权限问题
- ❌ 以为文档不存在
- ❌ 以为内容格式错误

**真正原因：**

- ✅ 使用了错误的操作方法
- ✅ 用 write 更新新创建的文档
- ✅ block_id 获取不正确

**解决方法：**

```bash
# 1. 先 list_blocks 获取 block_id
feishu_doc action=list_blocks doc_token=xxx

# 2. 使用 update_block 而非 write
feishu_doc action=update_block \
    doc_token=xxx \
    block_id=$BLOCK_ID \
    content="..."
```

### 3. 推荐的操作流程

```
创建文档 → 保存 doc_token
    ↓
需要更新 → list_blocks 获取 block_id
    ↓
更新内容 → update_block 更新区块
    ↓
验证结果 → read 检查更新
```

## 文件结构

```
~/.openclaw/skills/feishu-doc-guide/
├── SKILL.md            # 技能完整说明（详细）
├── QUICK_REFERENCE.md   # 快速参考（常用）
└── README.md          # 本文件（概述）
```

## 使用方式

### 方式1：查阅详细说明

遇到问题时，查看 SKILL.md：

```bash
cat ~/.openclaw/skills/feishu-doc-guide/SKILL.md
```

### 方式2：快速查找命令

日常使用时，查看 QUICK_REFERENCE.md：

```bash
cat ~/.openclaw/skills/feishu-doc-guide/QUICK_REFERENCE.md
```

### 方式3：了解技能概览

首次使用时，查看 README.md：

```bash
cat ~/.openclaw/skills/feishu-doc-guide/README.md
```

## 主要经验总结

### ✅ 成功经验

1. **方法选择正确**
   - 创建：create
   - 更新：update_block
   - 替换：write（慎用）

2. **获取 block_id**
   - 使用 list_blocks
   - 从响应中提取
   - 验证正确性

3. **验证更新**
   - 操作后读取文档
   - 检查 revision_id
   - 确认内容正确

### ❌ 失败教训

1. **误用 write 方法**
   - 试图用 write 更新新文档
   - 导致 400 错误
   - 误以为是权限问题

2. **忽略错误信息**
   - 看到 400 错误不处理
   - 盲目重试
   - 浪费时间排查

3. **不验证结果**
   - 更新后不检查
   - 不确定是否成功
   - 难以发现问题

## 相关技能

- **飞书通讯录技能：** `~/.openclaw/skills/feishu-contacts/`
- **飞书文档管理器：** `~/.openclaw/skills/feishu-doc-manager/`

## 版本信息

- 创建日期：2026-03-03
- 版本：1.0.0
- 维护者：CEO助手（元小芯）
- 状态：✅ 已完成

## 贡献

如果您在使用中发现新的问题或解决方案，请更新本技能文档。

---

技能创建时间：2026-03-03
创建原因：总结飞书文档写入经验，避免重复错误
