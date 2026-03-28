# Runtime Skill Templates

此目录用于存放技能相关的运行态模板。

当前结构：

- `base.json`: 共享 skill runtime 补丁，主要放 `skills.entries.*`
- `environments/<env>.json`: 环境差异补丁
- `env.example`: 技能运行态环境变量样例
- `feishu-suite/`、`ops-workflows/`: 分组说明与后续模板入口

这里不应放：

- 技能源码
- 真实 API key
- 运行输出产物

当前已接管的内容：

- `manage-platform-test` 与 `chandao` 的站点地址、账号、密码
- `connectproductserver` 的跳板机、目标主机、日志目录、服务名和 SSH 路径
- `gitee-coder` 的仓库宿主、默认 owner、默认仓库、默认分支、工作目录和 SSH 路径
- `yz-dev-java` 的项目根目录、Nacos 服务器、命名空间和配置部署目标
- `yz-build` 与 `yz-test-java` 的项目根目录
- `linear`、`monday`、`imap-smtp-email`、`neynar` 的运行态凭证入口
- `aliyun-oss-upload`、`lark-integration`、`tavily-search` 的 env 模板入口
- `base`、`zapper` 以及一批外部链上技能的默认禁用状态
