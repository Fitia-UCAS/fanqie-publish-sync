(function () {
  window.NovelCurrentPlotMethods = {
    collectCurrentPlotConfig(scopeOverride) {
      const selectedMode = document.querySelector('input[name="cpMode"]:checked')?.value || 'extract_merge';
      return {
        source: document.getElementById('cpSource')?.value || '',
        currentPlotFile: document.getElementById('cpCurrentPlotFile')?.value || '',
        outputDir: document.getElementById('cpOutputDir')?.value || '',
        outputFile: document.getElementById('cpOutputFile')?.value || '',
        platform: document.getElementById('cpPlatform')?.value || 'deepseek',
        apiKey: document.getElementById('cpApiKey')?.value || '',
        baseUrl: document.getElementById('cpBaseUrl')?.value || '',
        modelName: document.getElementById('cpModelName')?.value || '',
        temperature: Number(document.getElementById('cpTemperature')?.value || 0.2),
        chapter: document.getElementById('cpChapter')?.value || '',
        aroundChapter: document.getElementById('cpAroundChapter')?.value || '',
        start: document.getElementById('cpStart')?.value || '',
        end: document.getElementById('cpEnd')?.value || '',
        scope: scopeOverride || document.getElementById('cpScope')?.value || 'range',
        mode: selectedMode,
        targetWords: Number(document.getElementById('cpTargetWords')?.value || 260),
        recentContextCount: Number(document.getElementById('cpRecentContext')?.value || 5),
        replaceExisting: !!document.getElementById('cpReplaceExisting')?.checked,
        maxWorkers: Number(document.getElementById('cpWorkers')?.value || 4),
      };
    },

    bindCurrentPlotPage() {
      this.bindChooseFile(
        'cpChooseSource',
        'current_plot.source',
        'cpSource',
        '选择完整小说'
      );

      this.bindChooseFile(
        'cpChooseCurrentPlotFile',
        'current_plot.currentPlotFile',
        'cpCurrentPlotFile',
        '选择已有当前剧情'
      );

      this.bindChooseFolder(
        'cpChooseOutputDir',
        'current_plot.outputDir',
        'cpOutputDir',
        '自动生成 / 选择目录'
      );

      this.bindChooseFile(
        'cpChooseOutputFile',
        'current_plot.outputFile',
        'cpOutputFile',
        '自动命名 / 选择输出文件',
        null,
        true,
        '当前剧情.md'
      );

      document
        .getElementById('cpPlatform')
        ?.addEventListener('change', () => this.refreshCurrentPlotPlatformDefaults());

      document
        .querySelectorAll('[data-cp-scope]')
        .forEach((button) =>
          button.addEventListener('click', () =>
            this.currentPlotRun(button.dataset.cpScope || 'range')
          )
        );

      document
        .getElementById('cpStop')
        ?.addEventListener('click', () => this.stopTask('current_plot_stop', 'current_plot'));
    },

    async refreshCurrentPlotPlatformDefaults() {
      if (!this.api.current_plot_platform_defaults) return;

      const platform = document.getElementById('cpPlatform')?.value || 'deepseek';
      const result = await this.api.current_plot_platform_defaults(platform);

      if (!result || !result.ok) return;

      const base = document.getElementById('cpBaseUrl');
      const model = document.getElementById('cpModelName');

      if (base && !base.value) base.value = result.baseUrl || '';
      if (model && !model.value) model.value = result.modelName || '';

      this.debounceSavePage('current_plot');
    },

    async currentPlotRun(scope) {
      const hidden = document.getElementById('cpScope');
      if (hidden) hidden.value = scope || 'range';

      const payload = this.collectCurrentPlotConfig(scope);
      this.state.config.current_plot = payload;

      await this.saveConfig();

      const modeLabel =
        {
          serial: '逐章精修',
          extract_merge: '并发合并',
          fast_preview: '快速预览',
        }[payload.mode] || '当前剧情总结';

      this.beginTaskUi('current_plot', `准备更新当前剧情：${modeLabel}...`);

      const ok = await this.api.current_plot_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', 'current_plot');
    },
  };
})();