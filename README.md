# dsh-plugin-canvas

> Deployment-level **画布 / Canvas** plugin for [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) (DSH).  
> 在会话视图环中新增「画布」页签，让智能体可以把 HTML 设计稿原型渲染到画布，并通过位置标注和文字备注进行视觉评审。

中文简介：为 DeepSeek Harness Web 端提供「画布」页签。智能体可通过 `canvas_preview` 工具把网页 / 卡片 / 模拟器 / 图表 / 表单 / UI 界面等 HTML 设计稿渲染到画布，支持 `render`（渲染/替换）、`annotate`（追加标注）、`clear`（清空）三种模式，并支持本地 HTML 文件与远程 URL 预览。本插件内置隐私脱敏与沙箱渲染，避免敏感信息泄露。

---

## ✨ Features / 功能特性

- **会话视图环新增「画布」页签**：与轨迹 / 终端 / 虚拟机等页签并列，顺序在 `order: 13`。
- **`canvas_preview` 模型工具**：
  - `mode=render`：渲染或替换画布内容（`html` / `file` / `url` 三选一），可同时携带 `annotations` 与 `notes`（替换旧标注）。
  - `mode=annotate`：在现有画布上追加位置标注（百分比坐标）与自由文字备注。
  - `mode=clear`：清空当前画布。
- **交互式预览**：预览内容在沙箱 iframe 中打开，支持页面内脚本/表单/弹窗交互，但与宿主隔离（不共享 origin）。
- **位置标注**：以百分比坐标在画布上显示红色序号标记，鼠标点击可查看调整意见。
- **备注列表**：自由文字备注集中展示在预览下方。
- **本地文件预览**：读取允许目录内的 `.html` 文件（默认当前工作目录与 `~/.dsh/canvas`，可用 `DSH_CANVAS_ALLOW_ROOTS` 扩展）。
- **远程 URL 预览**：支持 `http/https` 页面，超时 10 秒、大小上限 2MB。
- **实时同步**：前端每 2 秒轮询 `/canvas-api/state`，模型工具更新后画布自动刷新。
- **内存态**：画布内容仅保存在宿主内存中，不写盘；会话销毁自动清理。

## 🔐 Privacy & Security / 隐私脱敏与安全设计

本插件特别关注隐私脱敏，默认开启以下保护：

| 项目 | 说明 |
|---|---|
| 敏感文件拦截 | 拒绝读取 `.env`、`.git`、`.git-credentials`、`credentials`、`secret`、`token`、`id_rsa`、`*.pem`、`*.key` 等敏感路径。 |
| 文件访问白名单 | 默认仅允许当前工作目录与 `~/.dsh/canvas`；可通过 `DSH_CANVAS_ALLOW_ROOTS=/path/a:/path/b` 增加白名单目录。 |
| 密钥内容脱敏 | 对 HTML/URL 内容中的 `api_key`、`access_token`、`secret`、`password`、`Authorization: Bearer`、`ghp_*`、`github_pat_*`、`AKIA*`、`sk-*`、私钥块等常见敏感值自动打码。 |
| 不落盘 | 画布内容仅保存在内存，不写入磁盘。 |
| 路径最小化 | 客户端只显示文件 basename 或完整 URL，不暴露本地绝对路径。 |
| 沙箱 iframe | 预览使用 `sandbox="allow-scripts allow-modals allow-forms allow-popups"`，**不启用** `allow-same-origin`，预览页面无法访问宿主页面数据。 |
| URL 凭据剥离 | 远程 URL 若带有 `user:pass@`，会在请求前移除，避免把凭据发送给目标服务器。 |

> 提示：如果你需要预览包含真实密钥的本地页面，请先在页面中自行替换为占位符，或使用 `DSH_CANVAS_ALLOW_ROOTS` 明确授权目录；插件仍会尽力打码常见密钥格式。

## 🚀 Install / 安装

> ⚠️ **重要：每个插件只注册一次，不要同时使用两条安装路径。**
> 
> - `dsh plugin add`（方式 A / B）会把插件加入 `dsh.profile.bundles`，插件自带的 `cordis.patch.yml` 会作为 bundle 层自动生效，**不需要再手动往 `cordis.patch.yml` 里加 `ui-canvas`**。
> - `./install.sh` 或手动 patch（方式 C / D）走 `cordis.patch.yml` 注册，**不要再用 `dsh plugin add`**。
> - 如果同时出现两份 `ui-canvas`，DSH 会报 `duplicate loader entry id: ui-canvas`。修复方式：二选一删除。`./install.sh` 已会自动从 `dsh.profile.bundles` 中移除本插件，避免重复。

### 方式 A：从 GitHub 源码安装（推荐）

```bash
# 直接使用 GitHub 仓库地址
dsh plugin --profile web add github:GHJIVHIDD/dsh-plugin-canvas

# 建议锁定 commit，避免后续推送改变实际安装的代码
dsh plugin --profile web add github:GHJIVHIDD/dsh-plugin-canvas#<commit-sha>
```

> **pnpm ≥ 10 构建授权**：如果第一次执行失败并提示 pnpm 拒绝运行 git 依赖的 `prepare` 脚本，请把以下内容加入该 profile 的 `pnpm-workspace.yaml`：

```yaml
# 文件位置：~/.dsh/profiles/web/pnpm-workspace.yaml
allowBuilds:
  "@deepseek-ai/dsh-plugin-canvas": true
```

然后重新执行安装命令。

### 方式 B：从 GitHub Releases 下载安装包 / tarball

安装包发布在 GitHub Releases，不放入源码目录。直接下载：

```bash
curl -L -o dsh-plugin-canvas-0.1.1.tgz \
  https://github.com/GHJIVHIDD/dsh-plugin-canvas/releases/download/v0.1.1/dsh-plugin-canvas-0.1.1.tgz

# 下载后安装
dsh plugin --profile web add ./dsh-plugin-canvas-0.1.1.tgz
```

也可以打开 Releases 页面手动下载：

```text
https://github.com/GHJIVHIDD/dsh-plugin-canvas/releases
```

或者使用本地源码目录：

```bash
dsh plugin --profile web add /path/to/dsh-plugin-canvas
```

### 方式 C：免 pnpm 手动安装脚本

```bash
git clone https://github.com/GHJIVHIDD/dsh-plugin-canvas.git
cd dsh-plugin-canvas
./install.sh
```

脚本会将插件复制到 `~/.dsh/profiles/web/node_modules/@deepseek-ai/dsh-plugin-canvas`，自动把 `ui-canvas` 补丁写入 `cordis.patch.yml`，并自动从 `dsh.profile.bundles` 中移除本插件（如有），避免重复注册。可用环境变量指定位置：

```bash
DSH_HOME=/path/to/.dsh DSH_PROFILE=web ./install.sh
```

### 方式 D：手动复制 + patch

```bash
# 1. 复制插件包到 profile 的 node_modules
mkdir -p ~/.dsh/profiles/web/node_modules/@deepseek-ai
cp -R dsh-plugin-canvas ~/.dsh/profiles/web/node_modules/@deepseek-ai/

# 2. 确认 ~/.dsh/profiles/web/cordis.patch.yml 中包含：
# - insert:
#     - id: ui-canvas
#       name: '@deepseek-ai/dsh-plugin-canvas'
```

安装后重启或刷新：

```bash
dsh --profile web
```

打开 Web 界面进入任意会话，在会话视图环中点击「画布」即可看到当前画布；智能体也可以通过 `canvas_preview` 工具自动渲染和标注。

## 🩹 Troubleshooting / 常见问题

### 报错 `duplicate loader entry id: ui-canvas`

原因：插件被同时注册到了两处：

1. `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 中包含 `@deepseek-ai/dsh-plugin-canvas`
2. `~/.dsh/profiles/web/cordis.patch.yml` 中也手动插入了 `ui-canvas`

修复（二选一）：

```bash
# 方案 1：保留 bundles 注册，删除 cordis.patch.yml 中的 ui-canvas 条目
# 方案 2：保留 patch 注册，从 package.json 的 bundles 中移除 @deepseek-ai/dsh-plugin-canvas
```

如果使用本仓库的 `./install.sh`，脚本会自动执行方案 2 的清理，并将原 `package.json` 备份为 `package.json.bak`。

### 打开画布页签提示 `⚠ HTTP 200`

通常是修改插件后没有重启 `dsh web`，导致浏览器拿到 SPA 的 HTML 而不是 API JSON。请重启：

```bash
# 先停掉当前 dsh web，再重新启动
dsh --profile web
```

如果重启后仍然 `HTTP 200`，请用 `dsh --profile web --dump-config` 检查 `ui-canvas` 是否只出现一次。

## 🧩 Architecture / 架构

```
浏览器 (client, lib/client.js)                       Node (host, lib/index.js)
┌──────────────────────────────────────┐   fetch   ┌──────────────────────────────────────┐
│ 画布页签 CanvasView                   │ ─────────▶ │ /canvas-api/state                    │
│ 沙箱 iframe + 标注/备注                │  /canvas-api/* │ /canvas-api/render                  │
│ 每 2 秒轮询状态                        │ ◀───────── │ /canvas-api/annotate                 │
└──────────────────────────────────────┘            │ /canvas-api/clear                     │
                                                     │ 内存态 + 隐私脱敏 + 文件/URL 读取      │
                                                     └──────────────────────────────────────┘
```

- 客户端注册 `conversation.view` 的 `canvas` 页签，使用与现有页签一致的主题变量。
- Host 半区零外部依赖，仅使用 Node 内置模块。
- 模型工具与 HTTP API 共用同一套画布状态，因此智能体调用 `canvas_preview` 后，前端轮询即可看到更新。

## 🛠 Canvas API / 接口

所有接口返回 `{ ok: true, state: {...} }` 或 `{ ok: false, error }`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/canvas-api/state?session=<id>` | 获取当前会话画布状态（HTML、标题、来源、标注、备注、更新时间） |
| POST | `/canvas-api/render` | 渲染/替换画布；body 同工具参数 |
| POST | `/canvas-api/annotate` | 追加标注与备注；body 需包含 `annotations` / `notes` |
| POST | `/canvas-api/clear` | 清空画布；body 可包含 `session` |

`render` / `annotate` 请求体示例：

```json
{
  "session": "session-123",
  "mode": "render",
  "html": "<!doctype html><html><body><h1>Hello</h1></body></html>",
  "annotations": [
    { "x": 25, "y": 40, "note": "标题建议加大字号" }
  ],
  "notes": ["整体配色可以更柔和"]
}
```

### License

This project is licensed under the Apache License 2.0.
See the full license at https://www.apache.org/licenses/LICENSE-2.0.