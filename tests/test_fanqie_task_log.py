from backend.runtime.jobs.callbacks import TaskCallbacks
from backend.runtime.run_logs.fanqie import FanqieTaskLog


def test_task_log_forwards_complete_runtime_output_to_frontend(tmp_path, monkeypatch) -> None:
    received: list[tuple[str, str]] = []
    monkeypatch.setattr(
        FanqieTaskLog,
        "_make_log_path",
        staticmethod(lambda **kwargs: tmp_path / "task.log"),
    )
    task_log = FanqieTaskLog(
        callbacks=TaskCallbacks(log=lambda message, level: received.append((message, level))),
        task_kind="auto_publish",
        operation="publish",
        start=1,
        end=1,
        total=1,
    )

    task_log.emit_start("publish", 1, 1)
    task_log.log("番茄发布调试截图已关闭。")
    task_log.log("本地：第 1 章《测试》")
    task_log.log("失败：第 1 章｜正文编辑器写入失败")
    task_log.finish(0, 1)

    messages = [message for message, level in received]
    assert "任务：番茄发布" in messages
    assert "番茄发布调试截图已关闭。" in messages
    assert "本地：第 1 章《测试》" in messages
    assert "失败：第 1 章｜正文编辑器写入失败" in messages
    assert "任务结束：成功 0/1。" in messages
