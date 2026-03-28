---
name: yz-build
description: 数芯安校园项目构建技能。用于执行 Maven 构建、代码质量检查、测试和覆盖率报告。支持完整构建、跳过测试构建、单模块构建和强制更新依赖。项目根目录通过 runtime-templates/skills 注入。
metadata:
  openclaw:
    emoji: "🏗️"
    requires:
      env:
        - YZ_JAVA_PROJECT_ROOT
---

# YZ Build

这个技能用于 yz-app 系列项目的构建、测试和代码质量检查。

## 运行边界

- 技能只保留构建规范和命令模板
- 项目根目录通过运行态环境变量注入
- 不在仓库中固化服务器路径或私有构建参数

## 推荐环境变量

```bash
YZ_JAVA_PROJECT_ROOT="${YZ_JAVA_PROJECT_ROOT:-~/workspace/yz-app}"
```

## 常用命令

在 `${YZ_JAVA_PROJECT_ROOT}` 下执行：

### 标准构建

```bash
mvn clean package -DskipTests
```

### 完整构建

```bash
mvn clean package
```

### 强制更新依赖

```bash
mvn clean package -U -DskipTests
```

### 单模块构建

```bash
mvn clean package -pl yz-app-core -am -DskipTests
mvn clean package -pl yz-app-datasource -am -DskipTests
mvn clean package -pl yz-app-common -am -DskipTests
```

### 质量检查

```bash
mvn checkstyle:check
mvn test
mvn jacoco:report
```

## 推荐流程

1. 先确认是完整构建、跳过测试还是单模块构建
2. 在项目根目录执行相应 Maven 命令
3. 检查构建结果和失败模块
4. 如果失败，先定位模块边界、依赖冲突或测试问题，再决定是否继续
