---
name: feishu-doc-guide
description: "飞书文档操作最佳实践指南。用于：(1) 理解 create/write/update_block 区别 (2) 解决 400 错误 (3) 文档更新流程 (4) 批量操作技巧。配合 feishu-doc 技能使用。"
metadata:
  { "openclaw": { "emoji": "📘", "requires": { "env": ["FEISHU_APP_ID", "FEISHU_APP_SECRET"] } } }
---

# 飞书文档操作指南技能

## 技能说明

提供飞书文档操作的最佳实践、注意事项和常见问题解决方案。

## 核心知识

### 1. 文档操作方法区别

#### create - 创建新文档

```bash
feishu_doc action=create title="标题" content="内容"
```

- 用于创建全新的文档
- 会生成新的 doc_token
- 不要用于更新已有文档

#### write - 替换整个文档

```bash
feishu_doc action=write doc_token=xxx content="新内容"
```

- 替换文档的**所有内容**
- 会删除所有原有内容
- 谨慎使用，会丢失原始结构

#### update_block - 更新指定区块

```bash
feishu_doc action=update_block doc_token=xxx block_id=xxx content="新内容"
```

- 更新文档的**指定区块**
- 保留文档其他内容
- 推荐：用于更新已有文档

### 2. 获取文档结构

#### list_blocks - 查看文档区块

```bash
feishu_doc action=list_blocks doc_token=xxx
```

- 返回文档的所有区块信息
- 获取 block_id
- 理解文档结构

#### read - 读取文档内容

```bash
feishu_doc action=read doc_token=xxx
```

- 返回文档的完整内容
- 查看当前内容
- 检查更新结果

### 3. 常见错误

#### 错误 400: Bad Request

**原因：**

1. 使用错误的方法（如用 write 更新新文档）
2. doc_token 不正确
3. block_id 不存在
4. 内容格式问题

**解决方案：**

```bash
# 1. 确认文档是否存在
feishu_doc action=read doc_token=xxx

# 2. 获取正确的 block_id
feishu_doc action=list_blocks doc_token=xxx

# 3. 使用 update_block 而非 write
feishu_doc action=update_block doc_token=xxx block_id=xxx content="..."
```

## 最佳实践

### 1. 更新文档的推荐流程

```bash
# 步骤1: 检查文档是否存在
DOC_TOKEN="<target-doc-token>"
feishu_doc action=read doc_token=$DOC_TOKEN

# 步骤2: 获取区块列表
BLOCKS=$(feishu_doc action=list_blocks doc_token=$DOC_TOKEN)
BLOCK_ID=$(echo "$BLOCKS" | jq -r '.blocks[0].block_id')

# 步骤3: 更新指定区块
feishu_doc action=update_block doc_token=$DOC_TOKEN block_id=$BLOCK_ID content="新内容"

# 步骤4: 验证更新
feishu_doc action=read doc_token=$DOC_TOKEN
```

### 2. 创建新文档

```bash
# 创建文档
RESULT=$(feishu_doc action=create title="新文档" content="内容")
DOC_TOKEN=$(echo "$RESULT" | jq -r '.document_id')

# 保存 doc_token
echo "$DOC_TOKEN" > /path/to/doc_token.txt
```

### 3. 批量更新

```bash
# 更新多个区块
for block_id in "block1" "block2" "block3"; do
    feishu_doc action=update_block \
        doc_token=$DOC_TOKEN \
        block_id=$block_id \
        content="区块 $block_id 的新内容"
    sleep 1  # 避免请求过快
done
```

## 注意事项

### 1. 权限要求

需要的权限：

- `docs:doc` - 文档操作
- `docs:doc:readonly` - 只读
- `docs:document.content:read` - 读取内容
- `docx:document` - 文档
- `docx:document:write_only` - 写入
- `docs:document.export` - 导出

检查权限：

```bash
feishu_app_scopes
```

### 2. 速率限制

- 避免短时间内发送大量请求
- 建议使用 sleep 间隔
- 批量操作时注意频率

### 3. 内容格式

- 支持 Markdown 格式
- 表格使用标准 Markdown 语法
- 代码块使用 \`\`\`
- 标题使用 # ## ###

## 常见场景

### 场景1: 更新通讯录文档

```bash
# 1. 获取区块列表
feishu_doc action=list_blocks doc_token="<target-doc-token>"

# 2. 获取根区块 ID
BLOCK_ID=$(jq -r '.blocks[0].block_id' /tmp/blocks.json)

# 3. 更新内容
feishu_doc action=update_block \
    doc_token="<target-doc-token>" \
    block_id=$BLOCK_ID \
    content="# 通讯录

## 更新时间
$(date '+%Y-%m-%d %H:%M:%S')

## 内容
..."
```

### 场景2: 创建日报文档

```bash
# 1. 创建新文档
TODAY=$(date '+%Y-%m-%d')
RESULT=$(feishu_doc action=create \
    title="日报 - $TODAY" \
    content="# 日报 - $TODAY

## 生成时间
$(date '+%H:%M:%S')

## 团队成员进度
...")

# 2. 保存 doc_token
DOC_TOKEN=$(echo "$RESULT" | jq -r '.document_id')
echo "$DOC_TOKEN" >> /tmp/daily_reports.txt
```

### 场景3: 追加日志

```bash
# 1. 读取当前内容
CURRENT=$(feishu_doc action=read doc_token=xxx)

# 2. 追加新内容
NEW_CONTENT="$CURRENT

## 新日志
$(date '+%Y-%m-%d %H:%M:%S') - 日志内容
"

# 3. 更新文档
BLOCK_ID=$(feishu_doc action=list_blocks doc_token=xxx | jq -r '.blocks[0].block_id')
feishu_doc action=update_block \
    doc_token=xxx \
    block_id=$BLOCK_ID \
    content="$NEW_CONTENT"
```

## 调试技巧

### 1. 查看响应详情

```bash
# 保存响应到文件
feishu_doc action=update_block \
    doc_token=xxx \
    block_id=xxx \
    content="..." \
    2>&1 | tee /tmp/response.json

# 检查响应
cat /tmp/response.json | jq '.'
```

### 2. 验证更新

```bash
# 更新后读取文档
feishu_doc action=read doc_token=xxx

# 对比内容
```

### 3. 记录操作日志

```bash
# 记录所有操作
echo "$(date '+%Y-%m-%d %H:%M:%S') - 更新文档 $DOC_TOKEN" >> <path-to-feishu-doc.log>
```

## 故障排除

### 问题1: 400 错误

**原因：** 使用了错误的操作方法

**解决：**

- 检查 doc_token 是否正确
- 确认 block_id 是否存在
- 使用 update_block 而非 write

### 问题2: 文档未更新

**原因：** 缓存或延迟

**解决：**

- 等待几秒后重新读取
- 检查 revision_id 是否变化
- 确认操作返回 success

### 问题3: 内容格式错误

**原因：** 特殊字符或格式问题

**解决：**

- 转义特殊字符
- 使用引号包裹内容
- 测试简单文本内容

## 版本信息

- 创建日期：2026-03-03
- 版本：1.0.0
- 维护者：CEO助手
- 状态：✅ 已完成
