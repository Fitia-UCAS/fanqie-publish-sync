(function () {
  window.NovelSplitterMethods = {
    bindNovelSplitterControls() {
      this.bindChooseFile('spChooseInput', 'novel_splitter.inputFile', 'spInputFile', '选择完整小说 TXT', async (path) => {
        const cfg = this.state.config.novel_splitter || (this.state.config.novel_splitter = {});
        if (!cfg.outputDirManual) await this.refreshNovelSplitOutput(path, true);
      });
      this.bindChooseFolder('spChooseOutput', 'novel_splitter.outputDir', 'spOutputDir', '自动生成 / 选择目录', async (path) => {
        const cfg = this.state.config.novel_splitter || (this.state.config.novel_splitter = {});
        cfg.outputDirManual = !!path;
      });
      document.getElementById('spInputFile')?.addEventListener('change', () => this.refreshNovelSplitOutput('', false));
      document.getElementById('spRun')?.addEventListener('click', () => this.runNovelSplitter());
      const cfg = this.state.config.novel_splitter || {};
      if ((document.getElementById('spInputFile')?.value || '').trim() && !cfg.outputDirManual && !cfg.outputDir) this.refreshNovelSplitOutput('', false);
    },
    collectNovelSplitConfig() {
      const cfg = this.state.config.novel_splitter || {};
      return {
        inputFile: document.getElementById('spInputFile')?.value || '',
        outputDir: document.getElementById('spOutputDir')?.value || '',
        outputDirManual: !!cfg.outputDirManual,
        splitMode: document.getElementById('spMode')?.value || 'chapter_count',
        chaptersPerFile: Number(document.getElementById('spChaptersPerFile')?.value || 10),
        maxSizeMb: Number(document.getElementById('spMaxSizeMb')?.value || 5),
        includePrelude: !!document.getElementById('spIncludePrelude')?.checked,
        cleanOutput: !!document.getElementById('spCleanOutput')?.checked,
      };
    },
    async runNovelSplitter() {
      const payload = this.collectNovelSplitConfig();
      this.state.config.novel_splitter = payload;
      await this.saveConfig();
      this.beginTaskUi('novel_splitter', '小说分割中...');
      const ok = await this.api.novel_split_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', 'novel_splitter');
    },
    async refreshNovelSplitOutput(path = '', force = false) {
      const cfg = this.state.config.novel_splitter || (this.state.config.novel_splitter = {});
      if (cfg.outputDirManual && !force) return;
      const inputFile = path || document.getElementById('spInputFile')?.value || '';
      if (!inputFile || !this.api.novel_split_preview) return;
      try {
        const result = await this.api.novel_split_preview(inputFile, '');
        if (result && result.ok && result.outputDir) {
          cfg.outputDir = result.outputDir;
          cfg.outputDirManual = false;
          this.updateFilePicker('spOutputDir', result.outputDir, '自动生成 / 选择目录');
          await this.persistPageConfig('process_novel');
        }
      } catch (error) {
        console.debug('novel split preview failed', error);
      }
    },
  };
})();
