(function () {
  window.NovelWebnovelWriterMethods = {
    webnovelProjectIdFromPath(path) {
      return String(path || '').trim();
    },

    collectWebnovelWriterConfig(extra = {}) {
      const projectPath = document.getElementById('wwProjectPath')?.value || '';
      const projectId = document.getElementById('wwProjectId')?.value || this.webnovelProjectIdFromPath(projectPath);
      return Object.assign({
        projectId,
        projectPath,
        novelFilePath: document.getElementById('wwNovelFilePath')?.value || '',
        title: '',
        storyConfigPath: document.getElementById('wwStoryConfigPath')?.value || '',
        platform: document.getElementById('wwPlatform')?.value || 'deepseek',
        apiKey: document.getElementById('wwApiKey')?.value || '',
        baseUrl: document.getElementById('wwBaseUrl')?.value || '',
        modelName: document.getElementById('wwModelName')?.value || '',
        temperature: Number(document.getElementById('wwTemperature')?.value || 0.72),
        maxTokens: Number(document.getElementById('wwMaxTokens')?.value || 8192),
        recentContextCount: Number(document.getElementById('wwRecentContext')?.value || 6),
        chapterNo: Number(document.getElementById('wwChapterNo')?.value || 1),
        chapterTitle: document.getElementById('wwChapterTitle')?.value || '',
        start: Number(document.getElementById('wwStart')?.value || 1),
        end: Number(document.getElementById('wwEnd')?.value || 1),
        targetWords: Number(document.getElementById('wwTargetWords')?.value || 2200),
        strictness: document.getElementById('wwStrictness')?.value || '标准门禁',
        autoFix: !!document.getElementById('wwAutoFix')?.checked,
      }, extra || {});
    },

    bindWebnovelWriterPage() {
      document.getElementById('wwPlatform')?.addEventListener('change', () => this.refreshWebnovelWriterPlatformDefaults());
      this.bindChooseFolder('wwChooseProjectPath', 'webnovel_writer.projectPath', 'wwProjectPath', '选择 / 新建项目目录', async (path) => {
        const projectId = this.webnovelProjectIdFromPath(path);
        const hidden = document.getElementById('wwProjectId');
        if (hidden) hidden.value = projectId;
        this.state.config.webnovel_writer = Object.assign({}, this.state.config.webnovel_writer || {}, { projectId, projectPath: path });
        await this.webnovelWriterEnsureProject('项目目录已选择。');
      });
      this.bindChooseFile('wwChooseNovelFilePath', 'webnovel_writer.novelFilePath', 'wwNovelFilePath', '选择 / 新建小说 TXT', async () => {
        await this.webnovelWriterEnsureProject('小说文件已选择。');
      }, true, '新书.txt');
      this.bindChooseFile('wwChooseStoryConfigPath', 'webnovel_writer.storyConfigPath', 'wwStoryConfigPath', '选择设定 Markdown / JSON', async () => {
        await this.webnovelWriterEnsureProject('设定文件已导入。');
      }, false, 'story_config.md');
      document.getElementById('wwPlanFull')?.addEventListener('click', () => this.webnovelWriterPlan('full'));
      document.getElementById('wwPlanVolume')?.addEventListener('click', () => this.webnovelWriterPlan('volume'));
      document.getElementById('wwPlanBlueprint')?.addEventListener('click', () => this.webnovelWriterPlan('blueprint'));
      document.getElementById('wwWriteChapter')?.addEventListener('click', () => this.webnovelWriterWrite(false));
      document.getElementById('wwBatchWrite')?.addEventListener('click', () => this.webnovelWriterWrite(true));
      document.getElementById('wwReview')?.addEventListener('click', () => this.webnovelWriterReview());
      document.getElementById('wwValidate')?.addEventListener('click', () => this.webnovelWriterValidate());
      document.getElementById('wwStop')?.addEventListener('click', () => this.stopTask('webnovel_writer_stop', 'webnovel_writer'));
      this.webnovelWriterRefreshProject(false);
    },

    async refreshWebnovelWriterPlatformDefaults() {
      if (!this.api.webnovel_writer_platform_defaults) return;
      const platform = document.getElementById('wwPlatform')?.value || 'deepseek';
      const result = await this.api.webnovel_writer_platform_defaults(platform);
      if (!result || !result.ok) return;
      const base = document.getElementById('wwBaseUrl');
      const model = document.getElementById('wwModelName');
      if (base && !base.value) base.value = result.baseUrl || '';
      if (model && !model.value) model.value = result.modelName || '';
      this.debounceSavePage('webnovel_writer');
    },

    async webnovelWriterEnsureProject(successMessage = '项目已就绪。') {
      if (!this.api.webnovel_writer_save_project) return false;
      const payload = this.collectWebnovelWriterConfig();
      if (!payload.projectPath && !payload.projectId) {
        this.setTaskStatus('webnovel_writer', '先选择小说项目目录。', 'warn');
        return false;
      }
      const result = await this.api.webnovel_writer_save_project(payload);
      if (!result || !result.ok) {
        this.setTaskStatus('webnovel_writer', result?.message || '项目初始化失败。', 'error');
        return false;
      }
      const meta = result.meta || {};
      const paths = result.paths || {};
      const projectId = meta.project_id || payload.projectPath || payload.projectId || '';
      const hidden = document.getElementById('wwProjectId');
      if (hidden) hidden.value = projectId;
      const projectInput = document.getElementById('wwProjectPath');
      if (projectInput && paths.root) projectInput.value = paths.root;
      const novelInput = document.getElementById('wwNovelFilePath');
      if (novelInput && meta.novel_file) novelInput.value = meta.novel_file;
      this.state.config.webnovel_writer = Object.assign({}, this.state.config.webnovel_writer || {}, this.collectWebnovelWriterConfig({ projectId, projectPath: paths.root || payload.projectPath }));
      this.setTaskStatus('webnovel_writer', successMessage, 'success');
      await this.webnovelWriterRefreshProject(false);
      return true;
    },

    async webnovelWriterLoadProject(projectId, projectPath = '') {
      if (!projectId || !this.api.webnovel_writer_load_project) return;
      const result = await this.api.webnovel_writer_load_project(projectId);
      if (!result || !result.ok) {
        this.setTaskStatus('webnovel_writer', result?.message || '项目读取失败。', 'error');
        return;
      }
      const cfg = this.state.config.webnovel_writer || {};
      this.state.config.webnovel_writer = Object.assign({}, cfg, {
        projectId,
        projectPath: projectPath || result.paths?.root || cfg.projectPath || '',
        novelFilePath: result.meta?.novel_file || cfg.novelFilePath || '',
      });
      this.setTaskStatus('webnovel_writer', '项目已载入。', 'success');
      await this.webnovelWriterRefreshProject(false);
    },

    async webnovelWriterRefreshProject(showToast = true) {
      const cfg = this.collectWebnovelWriterConfig();
      if (!cfg.projectId || !this.api.webnovel_writer_dashboard) return;
      const result = await this.api.webnovel_writer_dashboard(cfg.projectId);
      if (result && result.ok && showToast) {
        this.setTaskStatus('webnovel_writer', `已载入：正式章节 ${result.chapterCount || 0}，最新章 ${result.latestChapter || 0}。`, 'success');
      }
    },

    async webnovelWriterPlan(planType) {
      if (!(await this.webnovelWriterEnsureProject())) return;
      const payload = this.collectWebnovelWriterConfig({ planType });
      this.state.config.webnovel_writer = payload;
      await this.saveConfig();
      const label = { full: '全书大纲', volume: '分卷大纲', blueprint: '章节蓝图' }[planType] || '规划';
      this.beginTaskUi('webnovel_writer', `准备生成：${label}...`);
      const ok = await this.api.webnovel_writer_plan_run(payload);
      if (!ok) this.setTaskStatus('webnovel_writer', '任务没有启动，请查看日志。', 'warn');
    },

    async webnovelWriterWrite(batch) {
      if (!(await this.webnovelWriterEnsureProject())) return;
      const payload = this.collectWebnovelWriterConfig({ batch: !!batch });
      this.state.config.webnovel_writer = payload;
      await this.saveConfig();
      this.beginTaskUi('webnovel_writer', batch ? '准备批量写章...' : '准备写单章...');
      const ok = await this.api.webnovel_writer_write_run(payload);
      if (!ok) this.setTaskStatus('webnovel_writer', '任务没有启动，请查看日志。', 'warn');
    },

    async webnovelWriterReview() {
      if (!(await this.webnovelWriterEnsureProject())) return;
      const payload = this.collectWebnovelWriterConfig();
      this.state.config.webnovel_writer = payload;
      await this.saveConfig();
      this.beginTaskUi('webnovel_writer', '准备审查章节...');
      const ok = await this.api.webnovel_writer_review_run(payload);
      if (!ok) this.setTaskStatus('webnovel_writer', '任务没有启动，请查看日志。', 'warn');
    },

    async webnovelWriterValidate() {
      if (!(await this.webnovelWriterEnsureProject())) return;
      const payload = this.collectWebnovelWriterConfig();
      this.state.config.webnovel_writer = payload;
      await this.saveConfig();
      this.beginTaskUi('webnovel_writer', '准备全书校验...');
      const ok = await this.api.webnovel_writer_validate_run(payload);
      if (!ok) this.setTaskStatus('webnovel_writer', '任务没有启动，请查看日志。', 'warn');
    },
  };
})();
