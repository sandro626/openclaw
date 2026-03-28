---
name: chandao
description: "使用公司禅道项目管理系统。用于：(1) 查看和管理任务 (2) 创建和跟踪 Bug (3) 管理测试用例 (4) 项目进度跟踪。通过 browser 工具自动登录和操作。"
metadata:
  {
    "openclaw":
      {
        "emoji": "📋",
        "requires":
          {
            "anyBins": ["browser-use-cli"],
            "env": ["CHANDAO_URL", "CHANDAO_USERNAME", "CHANDAO_PASSWORD"],
          },
      },
  }
---

# 禅道 (Chandao) 技能

使用公司禅道项目管理系统的技能。通过 browser 工具自动登录和操作。

## 访问地址

- **禅道地址 env**: `CHANDAO_URL`
- **公司名**: 成都元智科技项目管理系统

## 账号配置

真实账号必须从 runtime 模板或环境变量注入，不能写回 skill 源码。

默认登录账号：

| 用途     | 用户名 env         | 密码 env           |
| -------- | ------------------ | ------------------ |
| 默认账号 | `CHANDAO_USERNAME` | `CHANDAO_PASSWORD` |

可选角色账号：

| 角色              | 用户名 env                         | 密码 env                           |
| ----------------- | ---------------------------------- | ---------------------------------- |
| 元小测 (功能测试) | `CHANDAO_FUNCTION_TESTER_USERNAME` | `CHANDAO_FUNCTION_TESTER_PASSWORD` |
| 元小宝 (产品经理) | `CHANDAO_PM_USERNAME`              | `CHANDAO_PM_PASSWORD`              |
| 元小开 (后端开发) | `CHANDAO_BACKEND_USERNAME`         | `CHANDAO_BACKEND_PASSWORD`         |
| 元小钱 (前端开发) | `CHANDAO_FRONTEND_USERNAME`        | `CHANDAO_FRONTEND_PASSWORD`        |
| 元小测 (PC测试)   | `CHANDAO_PC_TEST_USERNAME`         | `CHANDAO_PC_TEST_PASSWORD`         |

如果没有指定角色账号，默认使用 `CHANDAO_USERNAME` / `CHANDAO_PASSWORD`。

## 登录流程

使用 browser 工具自动登录禅道:

1. 打开 `$CHANDAO_URL`
2. 在用户名输入框填写目标账号 env 对应的值
3. 在密码输入框填写目标密码 env 对应的值
4. 点击登录按钮
5. 等待页面跳转

## 常用操作

- 我的任务: /index.php?m=my&f=work&mode=task
- 待处理Bug: /index.php?m=my&f=work&mode=bug
- 测试用例: /index.php?m=qa&f=index
- 项目管理: /index.php?m=project&f=browse

## ⚠️ 表单填写技巧（重要）

**关键经验**: 禅道表单填写不要直接用 `fill` 命令！

### 正确方法：click + type 配合

```
❌ 错误做法（会失败）:
browser_fill("#title", "测试标题")

✅ 正确做法（成功率高）:
browser_click("#title")      # 先点击输入框获取焦点
browser_type("测试标题")      # 再用 type 输入内容
```

### 创建测试用例示例

```javascript
// 1. 先点击输入框
browser_click(input[name=title])

// 2. 再输入内容
browser_type("TC-PC-001 新建对话功能测试")

// 3. 下拉选择框也要先点击
browser_click("#pri")  // 点击优先级下拉框
browser_click([data-value=3])  // 选择优先级3

// 4. 多行文本框同样
browser_click("#steps")
browser_type("步骤1: 打开对话界面\n步骤2: 输入测试消息")
```

### 原因分析

禅道前端使用了特殊的表单控件，直接 fill 可能无法触发输入事件，导致数据无法保存。使用 click + type 可以正确触发所有必要的事件。

## 测试用例创建

成功案例：

- ID 84: TC-PC-001 新建对话功能测试
- 创建者：元小测2-测试专家
- 优先级：3
- 使用 click + type 方式成功创建
