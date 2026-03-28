---
name: manage-platform-test
description: 使用管理平台测试环境完成登录、验证码输入与页面验证。站点地址和登录凭证必须通过 runtime 模板或环境变量注入，禁止在 skill 源码里硬编码。
metadata:
  {
    "openclaw":
      {
        "requires":
          {
            "env":
              ["BMSYS_TEST_URL", "BMSYS_TEST_USERNAME", "BMSYS_TEST_PASSWORD", "BMSYS_TEST_OTP"],
          },
      },
  }
---

# 管理平台测试地址

此技能只保留登录流程定义，不再在源码层保存真实测试地址、账号或验证码。

## 必需环境变量

- `BMSYS_TEST_URL`
- `BMSYS_TEST_USERNAME`
- `BMSYS_TEST_PASSWORD`
- `BMSYS_TEST_OTP`

这些值应来自：

- `skills.entries.manage-platform-test.env`
- 或进程环境变量

## 登录步骤

1. 打开 `$BMSYS_TEST_URL`
2. 输入 `$BMSYS_TEST_USERNAME` 和 `$BMSYS_TEST_PASSWORD`
3. 勾选用户协议
4. 点击下一步按钮
5. 在验证码输入框中输入 `$BMSYS_TEST_OTP`
6. 登录后再继续测试
