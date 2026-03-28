---
name: gitee-coder
description: Gitee 代码拉取与修改技能。用于：(1) 从 Gitee 仓库拉取代码，(2) 在本地工作目录中修改代码，(3) 提交并推送变更回 Gitee。仓库宿主、默认 owner、工作目录和 SSH key 路径通过 runtime-templates/skills 注入。
metadata:
  openclaw:
    emoji: "🧰"
---

# Gitee Coder

这个技能提供面向 Gitee 仓库的标准开发工作流入口。

适合的场景：

- 从 Gitee 拉取业务仓库并建立本地工作副本
- 配合 `git`、`build`、`test`、`claude-code-task` 等技能修改代码
- 提交、推送并准备后续联调或发布

## 运行边界

- Skill 只提供工作流约定和命令模板，不在仓库中保存真实仓库地址或 SSH 凭证
- 仓库宿主、默认 owner、工作目录和 SSH key 路径通过 runtime env 注入
- 涉及强制推送、重写历史或批量改动时，必须先向用户确认

## 运行态配置

### 推荐环境变量

```bash
GITEE_HOST="${GITEE_HOST:-gitee.com}"
GITEE_DEFAULT_OWNER="${GITEE_DEFAULT_OWNER:-}"
GITEE_DEFAULT_REPO="${GITEE_DEFAULT_REPO:-}"
GITEE_DEFAULT_BASE_BRANCH="${GITEE_DEFAULT_BASE_BRANCH:-master}"
GITEE_WORKDIR_ROOT="${GITEE_WORKDIR_ROOT:-~/.openclaw/workspace/repos}"
GITEE_SSH_KEY_PATH="${GITEE_SSH_KEY_PATH:-~/.ssh/id_ed25519_gitee}"
```

### 常用命令模板

#### 克隆仓库

```bash
repo="${GITEE_DEFAULT_REPO:?set GITEE_DEFAULT_REPO or pass repo explicitly}"
owner="${GITEE_DEFAULT_OWNER:?set GITEE_DEFAULT_OWNER or pass owner explicitly}"
workdir="${GITEE_WORKDIR_ROOT}/${repo}"

mkdir -p "${GITEE_WORKDIR_ROOT}"
GIT_SSH_COMMAND="ssh -i ${GITEE_SSH_KEY_PATH}" \
  git clone "git@${GITEE_HOST}:${owner}/${repo}.git" "${workdir}"
```

#### 更新已有副本

```bash
cd "${GITEE_WORKDIR_ROOT}/${GITEE_DEFAULT_REPO}"
git fetch origin
git switch "${GITEE_DEFAULT_BASE_BRANCH}"
git pull --ff-only origin "${GITEE_DEFAULT_BASE_BRANCH}"
```

#### 建立任务分支

```bash
cd "${GITEE_WORKDIR_ROOT}/${GITEE_DEFAULT_REPO}"
git switch -c "feature/<task-name>"
```

#### 提交并推送

```bash
cd "${GITEE_WORKDIR_ROOT}/${GITEE_DEFAULT_REPO}"
git status --short
git add <files>
git commit -m "<summary>"
GIT_SSH_COMMAND="ssh -i ${GITEE_SSH_KEY_PATH}" \
  git push -u origin HEAD
```

## 推荐工作流

1. 先确认目标仓库、目标分支和任务边界
2. 克隆或更新本地副本，避免在脏目录直接开发
3. 用 `git diff`、测试命令和相关技能完成修改
4. 提交前检查变更范围，不把临时文件、密钥或运行日志带进仓库
5. 推送前确认目标远端和目标分支

## 协作建议

- 需要复杂代码改动时，优先配合 `claude-code-task`
- 需要构建或回归验证时，配合 `build`、`test`
- 需要读取仓库状态或生成补丁时，优先使用 `git` skill 的标准命令

## 注意事项

- 不在仓库中保存 Gitee 账号、密码、token 或私钥
- 如果远端默认分支不是 `master`，应通过 `GITEE_DEFAULT_BASE_BRANCH` 覆盖
- 需要 `git push --force`、删除分支或改写历史时，先征求用户确认
