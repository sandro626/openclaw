# Overlay Extensions

此目录用于存放团队私有扩展。

适合放在这里的内容：

- 企业内部系统接入扩展
- 不准备并入主仓的业务扩展
- 需要独立版本节奏的扩展

不适合放在这里的内容：

- 运行态配置
- 真实账号绑定
- 临时调试副本
- 与 `extensions/<name>/` 完全重复、但没有明确分叉说明的镜像源码

装配规则：

- 只有带 `openclaw.plugin.json` 或 `package.json` 的子目录才会进入 `plugins.load.paths`
- 纯 README 占位目录不会被当成可加载插件
- 如果 `extensions/<name>/` 仍是当前构建真源，则同名 `overlay/extensions/<name>/` 只能作为接收位或私有分叉候选，不能继续充当第二份活跃源码
- 如果既没有显式 runtime 加载路径，也没有独立业务分叉说明，就不要继续保留同名镜像源码；应直接退休过时副本
- 同名私有分叉必须明确写清当前真源目录和后续切换计划
- 目录存在本身不等于启用；只有显式加入 `plugins.load.paths` 或复制到 runtime 插件目录后，overlay 插件才会生效
