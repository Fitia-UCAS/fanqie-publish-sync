<div align="center">

# FANQIE PUBLISH & SYNC ASSISTANT

番茄发布与同步助手

<img src="https://img.shields.io/badge/Python-Desktop%20App-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
<img src="https://img.shields.io/badge/pywebview-Local%20UI-111827?style=for-the-badge&logo=windowsterminal&logoColor=white" alt="pywebview" />
<img src="https://img.shields.io/badge/Playwright-Browser%20Automation-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />

</div>

## 项目简介

这是一个面向网文作者的本地桌面工具，用于在本地章节文件与番茄作家后台之间完成发布和同步操作。

项目当前只包含番茄发布和番茄同步两个页面。

## 当前功能

### 番茄发布

将指定范围内的本地章节发布到番茄作家后台，支持列表校验、步骤截图、失败截图、Git 追踪和手动定时。

发布任务可以暂缓、继续或终止。

### 番茄同步

支持将本地章节同步到番茄作家后台，也支持将番茄端章节拉取并写回本地文件。

同步与拉取任务都可以暂缓、继续或终止。同步过程中仍会使用内部差异检测能力，但桌面端不提供独立的“打开对比”入口。

## 支持的章节来源

可以选择单个 TXT 或 Markdown 文件，也可以选择包含章节文件的目录。章节范围由界面中的起始章节和结束章节控制。

## 运行方式

安装依赖后启动桌面应用：

```bash
pip install -r requirements.txt
playwright install chromium
python main.py
```

首次执行发布或同步时，请在自动打开的浏览器中完成番茄账号登录。应用会保存登录状态，也可以在界面中选择已有的状态文件或状态目录。

## 使用提醒

本项目是非官方本地辅助工具。请遵守番茄平台规则，并在正式操作前确认章节范围、小说来源和章节管理地址。

## 致谢

感谢 [番茄小说全自动发文机器人](https://github.com/hchcx/fanqie_auto_publish) 提供的界面设计参考。
