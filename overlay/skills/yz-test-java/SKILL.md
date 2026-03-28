---
name: yz-test-java
description: 数芯安校园 Java 测试技能。用于编写符合规范的单元测试和集成测试，覆盖 Controller、Service、Mapper 层；遵循 Given-When-Then、Mockito 和 Checkstyle 约束。项目根目录通过 runtime-templates/skills 注入。
metadata:
  openclaw:
    emoji: "🧪"
    requires:
      env:
        - YZ_JAVA_PROJECT_ROOT
---

# YZ Test Java

这个技能用于 yz-app 系列项目的 Java 测试编写与回归验证。

## 核心规范

### 命名规则

- 测试类命名：`Test` + 类名
- 测试方法命名：`test` + 方法名 + 场景
- 测试 SQL 命名：`test-` + 功能描述 + `.sql`
- 测试常量命名：`TEST_` + 描述

### 组织结构

```text
src/test/java/com/cdyzyc/app/{module}/
  controller/
  service/
  mapper/

src/test/resources/
  test-sql/
  application-test.yml
```

### 编写约束

- 统一使用 Given-When-Then
- 用 Mockito 做依赖 Mock
- 魔法数字提取为常量
- Controller 层覆盖参数校验、路径变量、请求参数、返回值与异常处理
- 测试代码同样要满足 Checkstyle 规范

## 推荐环境变量

```bash
YZ_JAVA_PROJECT_ROOT="${YZ_JAVA_PROJECT_ROOT:-~/workspace/yz-app}"
```

## 常用命令

在 `${YZ_JAVA_PROJECT_ROOT}` 下执行：

```bash
mvn test
mvn jacoco:report
mvn checkstyle:check
```

## 示例约定

```java
@Test
void testSaveConversationWithNewConversation() {
    // Given
    // When
    // Then
}
```

## 完成检查

- [ ] 测试类与测试方法命名符合规范
- [ ] 魔法数字已提取为常量
- [ ] 关键场景已覆盖
- [ ] `test-sql/` 和测试脚本已按规范命名
- [ ] 已执行测试和质量检查
