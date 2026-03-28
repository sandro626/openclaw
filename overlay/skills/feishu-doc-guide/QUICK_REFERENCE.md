# 飞书文档操作快速参考

## 方法速查表

| 方法         | 用途         | 适用场景     | 注意事项           |
| ------------ | ------------ | ------------ | ------------------ |
| create       | 创建新文档   | 首次创建     | 生成新的 doc_token |
| write        | 替换整个文档 | 完全重写     | 会删除所有原有内容 |
| update_block | 更新指定区块 | 更新现有文档 | 推荐使用，保留结构 |
| read         | 读取文档内容 | 查看内容     | 返回完整内容       |
| list_blocks  | 获取区块列表 | 理解结构     | 获取 block_id      |

## 快速开始

### 创建新文档

feishu_doc action=create title="标题" content="内容"

### 更新已有文档

# 1. 获取 block_id

BLOCKS=$(feishu_doc action=list_blocks doc_token=xxx)
BLOCK_ID=$(echo "$BLOCKS" | jq -r '.blocks[0].block_id')

# 2. 更新区块

feishu_doc action=update_block doc_token=xxx block_id=$BLOCK_ID content="新内容"

### 读取文档

feishu_doc action=read doc_token=xxx

## 常见错误

### 400 Bad Request

原因：

- 使用 write 更新不存在的文档
- block_id 不正确
- doc_token 格式错误

解决：

1. 检查文档是否存在
2. 获取正确的 block_id
3. 使用 update_block 而非 write

## 最佳实践

DO:

- 使用 update_block 更新现有文档
- 先 list_blocks 获取 block_id
- 操作后 read 验证结果

DON'T:

- 不要用 write 更新新创建的文档
- 不要忽略 400 错误
- 不要频繁请求

---

创建时间：2026-03-03
