from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.bootstrap import ApplicationServices, create_application_services
from backend.features.crawling.crawler_service import NovelCrawlerService
from backend.features.crawling.use_cases import crawl_web_chapters, preview_web_crawler_output
from backend.features.novel_processing.ad_cleaner import ad_profiles
from backend.features.novel_processing.chapter_parser import parse_chapter_source
from backend.features.novel_processing.clean_text import clean_text
from backend.features.novel_processing.models import Chapter as PreviewChapter
from backend.features.novel_processing.process_novel import analyze_novel_file, process_novel
from backend.features.novel_processing.split_novel import preview_novel_split_output, split_novel
from backend.infrastructure.desktop.dialogs import (
    open_file,
    open_login_state_dialog,
    open_native_dialog,
    open_path,
    open_source_dialog,
)
from backend.infrastructure.persistence.config import deep_update, load_config, save_config, set_config_path
from backend.interface.desktop.events import FrontendBridge
from backend.interface.desktop.tasks import DesktopTaskCoordinator, log_category_for_page
from backend.runtime.data_reset import reset_app_data, reset_login_state
from backend.runtime.logging import setup_logging
from backend.runtime.paths import FANQIE_AUTH_STATE_FILE, LOG_FILE, get_state_paths, latest_log_file
from backend.runtime.jobs.callbacks import TaskCallbacks
from backend.runtime.jobs.results import TaskResult


def _config_value(config: dict[str, Any], dotted_path: str) -> str:
    value: Any = config
    for part in str(dotted_path or "").split("."):
        if not isinstance(value, dict) or part not in value:
            return ""
        value = value.get(part)
    return str(value or "")


class WebviewApi:
    def __init__(self, services: ApplicationServices | None = None) -> None:
        self._window: Any | None = None
        self._config = load_config()
        self._services = services or create_application_services()
        self._bridge = FrontendBridge()
        self._tasks = DesktopTaskCoordinator(self._bridge)

    def bind_window(self, window: Any) -> None:
        self._window = window
        self._bridge.bind_window(window)

    def get_state(self) -> dict[str, Any]:
        character_material = self._services.character_material
        current_plot = self._services.current_plot
        return {
            "config": self._config,
            "recentFiles": [],
            "paths": get_state_paths(),
            "platforms": {"openai": "OpenAI", "local": "本地"},
            "crawlNovelSites": NovelCrawlerService.sites(),
            "characterMaterialPlatforms": character_material.platforms(),
            "characterMaterialDefaults": {
                key: character_material.default_platform_values(key)
                for key in character_material.platforms()
            },
            "currentPlotPlatforms": current_plot.platforms(),
            "currentPlotDefaults": {
                key: current_plot.default_platform_values(key)
                for key in current_plot.platforms()
            },
            "adProfiles": ad_profiles(),
            "logTail": self._read_log_tail(),
        }

    def save_config(self, config: dict[str, Any] | None) -> bool:
        deep_update(self._config, config or {})
        save_config(self._config)
        return True

    def choose_file(self, config_path: str = "", save: bool = False, save_filename: str = "output.txt") -> str:
        path = open_native_dialog(self._window, save=save, folder=False, save_filename=save_filename)
        return self._remember_path(config_path, path)

    def choose_folder(self, config_path: str = "") -> str:
        path = open_native_dialog(self._window, save=False, folder=True)
        return self._remember_path(config_path, path)

    def choose_source(self, config_path: str = "") -> str:
        current = _config_value(self._config, config_path)
        path = open_source_dialog(self._window, current_path=current)
        return self._remember_path(config_path, path)

    def choose_login_state(self, config_path: str = "") -> str:
        current = _config_value(self._config, config_path)
        path = open_login_state_dialog(self._window, current_path=current)
        return self._remember_path(config_path, path)

    def choose_directory(self, config_path: str = "") -> str:
        return self.choose_folder(config_path)

    def open_path(self, path_key: str) -> bool:
        return open_path(path_key)

    def open_log(self, page: str = "") -> bool:
        category = log_category_for_page(page)
        remembered = self._tasks.latest_log(category)
        if remembered and Path(remembered).exists():
            return open_file(remembered, create=True)
        return open_file(str(latest_log_file(category)), create=True)

    def open_backup(self, path: str = "") -> bool:
        return open_file(path) if path else open_path("process_novel_backups")

    def check_login_state(self) -> bool:
        return FANQIE_AUTH_STATE_FILE.exists()

    def do_login(self) -> bool:
        self._bridge.emit_log("auto_publish", "启动发布或同步后，请在自动打开的浏览器中完成登录。登录成功后会保存账号状态。", "info")
        return True

    def reset_login(self) -> dict[str, Any]:
        result = reset_login_state()
        level = "warning" if result.get("ok") else "error"
        self._bridge.emit_log("auto_publish", str(result.get("message") or "已重置授权。"), level)
        return result

    def reset_app_data(self) -> dict[str, Any]:
        result = reset_app_data(preserve_auth_state=True)
        setup_logging()
        self._config = load_config()
        level = "success" if result.get("ok") else "error"
        self._bridge.emit_log("auto_publish", str(result.get("message") or "已重置数据。"), level)
        return result

    def process_novel_analyze(self, file_path: str) -> dict[str, Any]:
        try:
            return analyze_novel_file(file_path).to_dict()
        except Exception as exc:
            return {"ok": False, "message": str(exc), "chapters": []}

    def process_novel_run(self, payload: dict[str, Any]) -> bool:
        return self._tasks.start("process_novel", payload.get("logTarget") or "process_novel", lambda callbacks: process_novel(payload, callbacks))

    def novel_split_preview(self, input_file: str = "", output_dir: str = "") -> dict[str, Any]:
        try:
            return preview_novel_split_output(input_file, output_dir)
        except Exception as exc:
            return {"ok": False, "message": str(exc), "outputDir": ""}

    def novel_split_run(self, payload: dict[str, Any]) -> bool:
        return self._tasks.start("novel_splitter", "novel_splitter", lambda callbacks: split_novel(payload, callbacks))

    def clean_text_run(self, payload: dict[str, Any]) -> bool:
        page = "clean_text_breaks" if payload.get("scope") == "move" else "clean_text_ads"
        return self._tasks.start("clean_text", page, lambda callbacks: clean_text(payload, callbacks))

    def auto_publish_list_chapters(self, file_path: str) -> dict[str, Any]:
        return self._list_chapters(file_path)

    def auto_publish_run(self, payload: dict[str, Any]) -> bool:
        return self._tasks.start("auto_publish", "auto_publish", lambda callbacks: self._services.publishing.execute(payload, callbacks))

    def chapter_sync_list_chapters(self, file_path: str) -> dict[str, Any]:
        return self._list_chapters(file_path)

    def chapter_sync_run(self, payload: dict[str, Any]) -> bool:
        return self._tasks.start("chapter_sync", "chapter_sync", lambda callbacks: self._services.syncing.execute(payload, callbacks))

    def web_crawler_preview(self, novel_url: str = "", output_file: str = "") -> dict[str, Any]:
        try:
            return preview_web_crawler_output(novel_url, output_file)
        except Exception as exc:
            return {"ok": False, "message": str(exc), "title": "", "outputFile": ""}

    def web_crawler_run(self, payload: dict[str, Any]) -> bool:
        return self._tasks.start("web_crawler", "web_crawler", lambda callbacks: crawl_web_chapters(payload, callbacks))

    def character_material_platform_defaults(self, platform: str = "deepseek") -> dict[str, Any]:
        try:
            return {"ok": True, **self._services.character_material.default_platform_values(platform)}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    def character_material_split(self, source: str) -> dict[str, Any]:
        try:
            path = self._services.character_material.split_novel(source)
            set_config_path(self._config, "character_material.source", str(path))
            save_config(self._config)
            return {
                "ok": True,
                "message": f"已切分章节目录：{path}",
                "path": str(path),
                "table": self._services.character_material.list_chapters(path),
            }
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    def character_material_list(self, source: str) -> dict[str, Any]:
        try:
            return {"ok": True, "message": "章节索引已读取。", "table": self._services.character_material.list_chapters(source)}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    def character_material_run(self, payload: dict[str, Any]) -> bool:
        def worker(callbacks: TaskCallbacks) -> TaskResult:
            result = self._services.character_material.extract(payload, callbacks)
            return TaskResult(
                ok=True,
                message=f"角色素材抽取完成：{result.output_path}",
                path=result.output_path,
                result_kind="output_file",
                data={"stats": result.stats.to_dict()},
            )

        return self._tasks.start("character_material", "character_material", worker)

    def current_plot_platform_defaults(self, platform: str = "deepseek") -> dict[str, Any]:
        try:
            return {"ok": True, **self._services.current_plot.default_platform_values(platform)}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    def current_plot_list(self, source: str) -> dict[str, Any]:
        try:
            return {"ok": True, "message": "章节索引已读取。", "table": self._services.current_plot.list_chapters(source)}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    def current_plot_run(self, payload: dict[str, Any]) -> bool:
        def worker(callbacks: TaskCallbacks) -> TaskResult:
            result = self._services.current_plot.update(payload, callbacks)
            return TaskResult(
                ok=True,
                message=f"当前剧情更新完成：{result.output_path}",
                path=result.output_path,
                result_kind="output_file",
                data=result.to_dict(),
            )

        return self._tasks.start("current_plot", "current_plot", worker)

    def character_material_stop(self) -> bool:
        return self._tasks.stop("character_material", "character_material", "已请求停止抽取，当前章节结束后会停下。")

    def current_plot_stop(self) -> bool:
        return self._tasks.stop("current_plot", "current_plot", "已请求停止总结，当前章节结束后会停下。")

    def auto_publish_stop(self) -> bool:
        return self._tasks.stop("auto_publish", "auto_publish", "已请求停止发布，当前章节结束后会停下。")

    def chapter_sync_stop(self) -> bool:
        return self._tasks.stop("chapter_sync", "chapter_sync", "已请求停止同步，当前章节结束后会停下。")

    def auto_publish_pause(self) -> bool:
        return self._tasks.pause("auto_publish", "auto_publish", "已暂停发布。")

    def auto_publish_resume(self) -> bool:
        return self._tasks.resume("auto_publish", "auto_publish", "已继续发布。")

    def chapter_sync_pause(self) -> bool:
        return self._tasks.pause("chapter_sync", "chapter_sync", "已暂停同步。")

    def chapter_sync_resume(self) -> bool:
        return self._tasks.resume("chapter_sync", "chapter_sync", "已继续同步。")

    def web_crawler_stop(self) -> bool:
        return self._tasks.stop("web_crawler", "web_crawler", "已请求停止爬取，正在取消未开始的章节。")

    def webnovel_writer_platform_defaults(self, platform: str = "deepseek") -> dict[str, Any]:
        return self._removed_webnovel_writer()

    def webnovel_writer_list_projects(self) -> dict[str, Any]:
        return self._removed_webnovel_writer()

    def webnovel_writer_save_project(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._removed_webnovel_writer()

    def webnovel_writer_load_project(self, project_id: str = "") -> dict[str, Any]:
        return self._removed_webnovel_writer()

    def webnovel_writer_dashboard(self, project_id: str = "") -> dict[str, Any]:
        return self._removed_webnovel_writer()

    def webnovel_writer_plan_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_write_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_review_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_export_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_validate_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_context_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_sync_control_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_templates_run(self, payload: dict[str, Any]) -> bool:
        return False

    def webnovel_writer_stop(self) -> bool:
        return False

    def _removed_webnovel_writer(self) -> dict[str, Any]:
        return {"ok": False, "message": "网文写作后端功能已移除。"}

    def _list_chapters(self, file_path: str) -> dict[str, Any]:
        try:
            chapters = parse_chapter_source(file_path)
            preview = [
                PreviewChapter(
                    number=chapter.number,
                    title=chapter.subtitle,
                    body=chapter.content,
                    raw_heading=chapter.full_title,
                ).to_preview()
                for chapter in chapters
            ]
            return {"ok": True, "message": f"已识别 {len(chapters)} 个章节。", "chapters": preview}
        except Exception as exc:
            return {"ok": False, "message": str(exc), "chapters": []}

    def _remember_path(self, config_path: str, path: str) -> str:
        if path and config_path:
            set_config_path(self._config, config_path, path)
            save_config(self._config)
        return path

    def _read_log_tail(self, limit: int = 3500) -> str:
        try:
            return LOG_FILE.read_text(encoding="utf-8", errors="ignore")[-limit:] if LOG_FILE.exists() else ""
        except Exception:
            return ""


NovelToolsApi = WebviewApi

__all__ = ["WebviewApi", "NovelToolsApi"]
