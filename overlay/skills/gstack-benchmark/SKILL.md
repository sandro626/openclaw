---
name: gstack-benchmark
description: |
  性能回归对比与基准测试：基线建立、回归检测、压测、容量规划。
metadata:
  openclaw: {}
---

# gstack-benchmark 性能基准测试

使用 gstack 浏览器守护进程进行性能回归对比与基准测试。

**承载 agent**: ops, dev
**触发场景**: "性能测试"、"benchmark"、"回归对比"、"性能检查"、"压测"

## 1. 性能基线建立

### API 响应时间基线

对每个待测端点采集 30 次请求，记录 P50/P95/P99、最大值、错误率。

### 页面加载基线（Core Web Vitals）

通过 gstack CDP 采集 Performance metrics：

| 指标 | 含义         | 目标值  |
| ---- | ------------ | ------- |
| LCP  | 最大内容绘制 | < 2.5s  |
| FID  | 首次输入延迟 | < 100ms |
| CLS  | 累积布局偏移 | < 0.1   |
| TTFB | 首字节时间   | < 200ms |
| FCP  | 首次内容绘制 | < 1.8s  |

### 资源使用基线

采集 CPU 峰值、内存均值/峰值、数据库活跃连接数、慢查询数(>1s)。

### 基线存储格式

路径: `~/.openclaw/benchmarks/{project}/baseline_{YYYYMMDD}.json`

```json
{
  "project": "openclaw-gateway",
  "timestamp": "2026-03-31T10:00:00Z",
  "commit": "a1b2c3d",
  "environment": { "os": "linux", "cpu": "4c", "memory": "8G" },
  "api": [{ "endpoint": "POST /api/v1/messages", "p50": 120, "p95": 340, "p99": 580 }],
  "web_vitals": { "lcp": 1.8, "fid": 45, "cls": 0.05 },
  "resources": { "cpu_peak": 45, "mem_mean": 380, "mem_peak": 620 }
}
```

## 2. 回归对比

### 对比流程

1. 加载最新基线文件
2. 执行当前版本全量采集
3. 逐项对比，标记退化

### 退化判定规则

| 变化幅度    | 等级 | 动作           |
| ----------- | ---- | -------------- |
| > 10% 回退  | 退化 | 标红，阻断发布 |
| 5%~10% 回退 | 警告 | 标黄，人工确认 |
| < 5% 变化   | 正常 | 绿色通过       |
| > 5% 提升   | 改善 | 标蓝，记录     |

### 对比报告格式

```
## 回归对比报告
基线: 2026-03-25 (commit a1b2c3d)
当前: 2026-03-31 (commit e4f5g6h)

### API 响应时间
| 端点                  | 基线 P95 | 当前 P95 | 变化  | 状态 |
| --------------------- | -------- | -------- | ----- | ---- |
| POST /api/v1/messages | 340ms    | 520ms    | +53%  | 退化 |
| GET /api/v1/status    | 80ms     | 78ms     | -2.5% | 正常 |

### Web Vitals
| 指标 | 基线 | 当前 | 变化 | 状态 |
| ---- | ---- | ---- | ---- | ---- |
| LCP  | 1.8s | 2.1s | +17% | 退化 |
| CLS  | 0.05 | 0.04 | -20% | 改善 |

### 结论
退化: 2 | 警告: 0 | 改善: 1
建议: 阻断发布，排查 messages 端点和 LCP 回退原因
```

## 3. 性能检查清单

每次发布前逐项检查：

**API 响应时间**: P95 < SLA(默认 500ms)、P99 无突刺(< 10% 偏差)、错误率 < 0.5%

**数据库查询**: 慢查询(>1s)未增加、无 N+1(同一语句 > 5 次/请求)、连接池 < 80%

**前端资源**: JS bundle < 500KB gzip、CSS < 100KB gzip、图片用 WebP/AVIF

**内存泄漏**: 运行 1h 内存增长 < 10%、EventListener/定时器正确清理、缓存有淘汰策略

**并发能力**: 50 并发 P95 < SLA、100 并发无 5xx、数据库连接不耗尽

## 4. 压测模式

### 逐步加压策略

```
阶段 1:  10 并发, 2 分钟 (预热)
阶段 2:  25 并发, 3 分钟 (常规负载)
阶段 3:  50 并发, 5 分钟 (峰值负载)
阶段 4: 100 并发, 5 分钟 (极限压力)
阶段 5: 200 并发, 3 分钟 (破坏性测试)
```

每阶段采集: 响应时间分布、错误率、CPU/内存、数据库连接数。

### 瓶颈定位

| 瓶颈信号               | 可能原因        | 排查方向            |
| ---------------------- | --------------- | ------------------- |
| CPU 接近 100%          | 计算密集        | 算法优化/水平扩展   |
| 内存持续上涨不回收     | 泄漏            | heap snapshot       |
| 响应时间随并发线性增长 | 锁竞争/队列阻塞 | 异步化/连接池调优   |
| 错误率在特定并发突增   | 资源耗尽        | 文件描述符/连接上限 |
| 慢查询随并发激增       | 缺索引/锁等待   | explain/索引优化    |

### 容量规划建议

```
当前配置: 4C / 8G / 50 连接池
安全容量: 80 并发 (P95 < 500ms, 错误率 < 0.1%)
最大容量: 120 并发 (P95 < 1s, 错误率 < 1%)
扩展建议: 达到 80 并发时水平扩展，每实例承担 40 并发
```

## 5. 输出格式

### 性能基线报告

```
# 性能基线报告
项目: {project} | 日期: {date} | Commit: {commit} | 环境: {env}
## API 性能: {api_table}
## Web Vitals: {web_vitals_table}
## 资源使用: {resources_table}
结论: 基线已建立，可作为回归对比依据。
```

### 回归对比报告

```
# 回归对比报告
基线: {baseline_date} ({baseline_commit})
当前: {current_date} ({current_commit})
## 对比结果: {comparison_table}
## 退化详情: {regression_details}
## 建议操作: {recommendation}
```

### 压测报告

```
# 压测报告
项目: {project} | 日期: {date}
## 加压过程: {stages_table}
## 瓶颈分析: {bottleneck_analysis}
## 容量建议: {capacity_recommendation}
## 改进建议: {improvement_suggestions}
```

## 使用方式

通过 gstack 采集浏览器性能:

```bash
# 页面性能指标
gstack navigate {url} --collect-performance
# 网络请求耗时
gstack snapshot --network-timing
# 对比两次采集
gstack benchmark compare baseline_{date}.json current.json
```

通过 Bash 执行 API 压测:

```bash
# wrk 压测
wrk -t4 -c50 -d30s --latency https://{host}/api/v1/messages
# ab 负载测试
ab -n 1000 -c 50 https://{host}/api/v1/status
```

## 注意事项

1. 基线在稳定预发布环境采集，排除网络波动
2. 每次发布前必须执行回归对比
3. 压测在专用环境进行，避免影响生产
4. 基线文件纳入版本管理，方便团队共享
5. 退化阻断规则可根据项目 SLA 调整阈值
