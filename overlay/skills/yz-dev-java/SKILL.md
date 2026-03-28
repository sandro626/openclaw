---
name: yz-dev-java
description: 数芯安校园 Java 开发技能。用于在 yz-app 系列项目中按照多数据源、Checkstyle、Nacos 配置中心和模块边界规范进行开发；设计文档存 docs/，SQL 脚本存 sql/，环境配置存 nacos-configs/。运行态路径和 Nacos 服务器信息通过 runtime-templates/skills 注入。
metadata:
  openclaw:
    emoji: "☕"
    requires:
      env:
        - YZ_JAVA_PROJECT_ROOT
        - YZ_JAVA_NACOS_SERVER_ADDR
        - YZ_JAVA_NACOS_DEV_NAMESPACE
        - YZ_JAVA_NACOS_TEST_NAMESPACE
        - YZ_JAVA_NACOS_PROD_NAMESPACE
        - YZ_JAVA_CONFIG_DEPLOY_HOST
        - YZ_JAVA_CONFIG_DEPLOY_USER
        - YZ_JAVA_CONFIG_DEPLOY_DIR
---

# YZ Dev Java

这个技能用于 yz-app 系列项目的 Java 开发，内容基于服务器现行 `yz-dev-java` 技能真源回迁，并已剥离敏感地址和凭证。

## 核心规则

### 多数据源

- 基础信息查询使用 `default` 数据源
- 学校业务数据使用 `schoolId.toString()` 对应的数据源
- 统一通过 `DataSourceTemplate.execute(...)` 切换数据源
- 避免在一个 `execute(...)` 里再嵌套跨数据源切换

示例：

```java
final Schools school = dataSourceTemplate.execute("default", () ->
    schoolsService.getById(schoolId)
);

final List<StudentInfo> students = dataSourceTemplate.execute(schoolId.toString(), () ->
    studentMapper.selectBySchoolId(schoolId)
);
```

### Checkstyle

- 行长度不超过 120
- 方法参数优先使用 `final`
- 公共方法补完整 Javadoc
- 魔法数字提取为常量
- 测试类命名 `Test` + 类名
- 测试方法命名 `test` + 方法名 + 场景

### Nacos 配置

- 配置文件落在 `nacos-configs/{env}/`
- 配置变更走“本地文件 -> 服务器 -> Nacos 导入脚本”流程
- 不直接在 Nacos 控制台改生产配置
- 敏感值不硬编码进源码或文档

推荐环境变量：

```bash
YZ_JAVA_PROJECT_ROOT="${YZ_JAVA_PROJECT_ROOT:-~/workspace/yz-app}"
YZ_JAVA_NACOS_SERVER_ADDR="${YZ_JAVA_NACOS_SERVER_ADDR:-nacos.example.com:8848}"
YZ_JAVA_NACOS_DEV_NAMESPACE="${YZ_JAVA_NACOS_DEV_NAMESPACE:-yz-app-dev}"
YZ_JAVA_NACOS_TEST_NAMESPACE="${YZ_JAVA_NACOS_TEST_NAMESPACE:-yz-app-test}"
YZ_JAVA_NACOS_PROD_NAMESPACE="${YZ_JAVA_NACOS_PROD_NAMESPACE:-yz-app-prod}"
YZ_JAVA_CONFIG_DEPLOY_HOST="${YZ_JAVA_CONFIG_DEPLOY_HOST:-config-host.example.com}"
YZ_JAVA_CONFIG_DEPLOY_USER="${YZ_JAVA_CONFIG_DEPLOY_USER:-deployer}"
YZ_JAVA_CONFIG_DEPLOY_DIR="${YZ_JAVA_CONFIG_DEPLOY_DIR:-/opt/yz-app/nacos-configs}"
```

## 模块边界

基础模块：

- `yz-app-core`: 工具类、公共基类、通用配置
- `yz-app-common`: DTO、枚举、常量、接口定义
- `yz-app-datasource`: 多数据源切换实现

业务模块：

- `yz-app-system`: 系统管理
- `yz-app-machines`: 设备管理
- `yz-app-schools`: 学校管理
- `yz-app-parents`: 家长端
- `yz-app-main`: 业务聚合入口

独立部署模块：

- `yz-app-api`: 对外接口适配，只依赖 `common`、`datasource`、`core`
- `yz-app-client-biz`: 设备数据采集、MQTT 接收和异步处理

## 目录约定

```text
docs/
  system/
  machines/
  api/

sql/
  system/
  machines/
  migration/

nacos-configs/
  common/
  dev/
  test/
  prod/
```

## 常用命令

在 `${YZ_JAVA_PROJECT_ROOT}` 下执行：

```bash
mvn clean package -DskipTests
mvn clean package
mvn checkstyle:check
mvn test
mvn jacoco:report
```

按模块构建：

```bash
mvn clean package -pl yz-app-core -am -DskipTests
mvn clean package -pl yz-app-datasource -am -DskipTests
mvn clean package -pl yz-app-common -am -DskipTests
```

## 开发流程

1. 先明确需求、涉及模块和数据源边界
2. 在 `docs/` 补设计说明，在 `sql/` 补 SQL 脚本
3. 按模块边界实现代码，严格使用 `DataSourceTemplate`
4. 如涉及配置项，先改 `nacos-configs/`，再通过脚本导入
5. 运行构建、Checkstyle 和测试

## 完成检查

- [ ] 数据源切换使用 `DataSourceTemplate.execute(...)`
- [ ] 公共方法 Javadoc 完整
- [ ] 魔法数字已提取为常量
- [ ] 测试命名和 `test-sql/` 命名符合规范
- [ ] `nacos-configs/` 已同步，未直接在控制台改配置
- [ ] 已执行 Maven 构建和测试检查
