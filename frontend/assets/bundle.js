// bundle.js —— 由 tools/bundle_js.py 自动生成，请勿手动编辑


// --- assets/core/page_registry.js ---
(function () {
  window.NovelConstants = {
    pageTitles: {
      auto_publish: ['发布', '番茄发布'],
      chapter_sync: ['同步', '番茄同步'],
    },
    defaultPage: 'auto_publish',
  };
})();


// --- assets/core/form_controls.js ---
(function () {
  window.NovelUiMethods = {
    escape(value) {
      return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
    },
    attr(value) {
      return this.escape(value);
    },
    basename(path) {
      const text = String(path || '').trim();
      if (!text) return '';
      const items = text.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      if (items.length > 1) return `${items.length} 个文件`;
      const cleaned = items[0].replace(/[\\/]+$/, '');
      const parts = cleaned.split(/[\\/]+/);
      return parts[parts.length - 1] || cleaned;
    },
    filePicker(inputId, value, buttonId, emptyText) {
      const name = this.basename(value);
      return `<input type="hidden" id="${this.attr(inputId)}" value="${this.attr(value || '')}" />
        <div class="file-picker ${name ? '' : 'empty'}" data-file-picker="${this.attr(inputId)}">
          <div class="file-meta"><span>已选择</span><strong id="${this.attr(inputId)}Name">${this.escape(name || emptyText || '未选择')}</strong></div>
          <button class="ghost-btn" id="${this.attr(buttonId)}" type="button">选择</button>
        </div>`;
    },
    updateFilePicker(inputId, path, emptyText) {
      const input = document.getElementById(inputId);
      if (input) input.value = path || '';
      const label = document.getElementById(`${inputId}Name`);
      if (label) label.textContent = this.basename(path) || emptyText || '未选择';
      const picker = document.querySelector(`[data-file-picker="${inputId}"]`);
      if (picker) picker.classList.toggle('empty', !this.basename(path));
    }
  };
})();


// --- assets/core/state_store.js ---
(function () {
  function initialState(page) {
    return {
      page,
      phase: '等待',
      status: '等待执行',
      level: 'info',
      current: 0,
      total: 0,
      percent: 0,
      fetched: 0,
      written: 0,
      failed: 0,
      limited: 0,
      retryRound: 0,
      lastEventType: 'idle',
      updatedAt: Date.now(),
    };
  }

  function progressPercent(current, total) {
    const totalValue = Math.max(0, Number(total || 0));
    const currentValue = Math.max(0, Number(current || 0));
    if (totalValue <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((currentValue / totalValue) * 100)));
  }

  function applyLabelStats(state, event) {
    const label = String(event.label || '');
    const eventType = String(event.eventType || '');
    if (label === '阶段') state.phase = event.message || '执行中';
    if (label === '补抓') state.retryRound += 1;
    if (label === '抓取' || eventType === 'chapter_fetched') state.fetched += 1;
    if (label === '写入' || eventType === 'chapter_written') state.written += 1;
    if (label === '失败' || eventType === 'failed') state.failed += 1;
    if (label === '限流' || eventType === 'rate_limited') state.limited += 1;
    if (label === '完成') state.phase = '完成';
    if (label === '停止') state.phase = '停止';
    if (label === '错误') state.phase = '错误';
  }

  window.NovelTaskStateStore = {
    create() {
      return {
        states: {},
        ensure(page) {
          const key = String(page || 'auto_publish');
          if (!this.states[key]) this.states[key] = initialState(key);
          return this.states[key];
        },
        begin(page, message) {
          const state = initialState(page);
          state.status = message || '任务启动中...';
          state.phase = '启动';
          this.states[page] = state;
          return state;
        },
        applyEvent(event) {
          const page = String(event && event.page || 'auto_publish');
          const state = this.ensure(page);
          const payload = event && event.payload || {};
          const progress = payload.progress || null;
          if (progress) this.setProgress(page, progress.current, progress.total);
          applyLabelStats(state, event || {});
          state.status = event.displayMessage || (event.label && event.message ? `${event.label}：${event.message}` : event.message) || state.status;
          state.level = event.level || state.level;
          state.lastEventType = event.eventType || state.lastEventType;
          state.updatedAt = Date.now();
          return state;
        },
        setProgress(page, current, total) {
          const state = this.ensure(page);
          state.current = Math.max(0, Number(current || 0));
          state.total = Math.max(0, Number(total || 0));
          state.percent = progressPercent(state.current, state.total);
          state.updatedAt = Date.now();
          return state;
        },
        finish(page, ok, message) {
          const state = this.ensure(page);
          state.phase = ok ? '完成' : '错误';
          state.status = message || (ok ? '任务完成' : '任务失败');
          state.level = ok ? 'success' : 'error';
          if (ok && state.total > 0) {
            state.current = state.total;
            state.percent = 100;
          }
          state.updatedAt = Date.now();
          return state;
        },
        snapshot(page) {
          return Object.assign({}, this.ensure(page));
        },
      };
    },
  };
})();


// --- assets/core/task_panel.js ---
(function () {
  window.NovelTaskPanelMethods = {
    renderTerminalPanel(page) {
      const statusOnly = this.isStatusOnlyPage(page);
      const logless = this.isLoglessPage(page);
      const actions = `<button class="terminal-clear" data-clear-output="${this.attr(page)}" type="button">清空</button>
            <button class="terminal-copy" data-copy-output="${this.attr(page)}" type="button">复制</button>
            <button class="terminal-open-log" data-open-log="${this.attr(page)}" type="button">打开日志</button>
            <button class="terminal-open-backup" data-open-backup="${this.attr(page)}" type="button">打开备份</button>
            <button class="terminal-open" data-open-output="${this.attr(page)}" type="button">打开目录</button>`;
      return `<div class="terminal-card ${statusOnly ? 'status-panel' : ''} ${logless ? 'logless-panel' : ''}">
        <div class="terminal-head">
          <div class="terminal-dots"><i></i><i></i><i></i></div>
          <b>任务进度</b>
          <div class="terminal-actions">
            ${actions}
          </div>
        </div>
        <div class="terminal-progress" id="${this.attr(page)}ProgressWrap">
          <span id="${this.attr(page)}ProgressText">0/0</span>
          <div class="progress" id="${this.attr(page)}ProgressTrack"><i id="${this.attr(page)}ProgressBar"></i></div>
          <span id="${this.attr(page)}ProgressPercent">0%</span>
        </div>
        <div class="terminal-status info" id="${this.attr(page)}Status">等待执行</div>
        ${logless ? '' : `<div class="terminal-log" id="${this.attr(page)}Log"></div>`}
      </div>`;
    },

    statePath(key) {
      return (this.state && this.state.paths && this.state.paths[key]) || key;
    },
    outputPathForPage(page) {
      const featureRootPages = {
        auto_publish: 'fanqie_publisher',
        chapter_sync: 'fanqie_syncer',
      };
      if (featureRootPages[page]) return this.statePath(featureRootPages[page]);
      return this.lastOutputs[page] || this.statePath('data');
    },
    async openOutputDir(page) {
      const path = this.outputPathForPage(page);
      if (!path || !this.api.open_path) return this.toast('没有可打开的输出目录。', 'warning', page);
      const ok = await this.api.open_path(path);
      if (!ok) this.toast('打开输出目录失败。', 'error', page);
    },
    async openTaskLog(page) {
      if (!this.api.open_log) return this.toast('当前版本不支持直接打开日志。', 'warning', page);
      const ok = await this.api.open_log(page);
      if (!ok) this.toast('打开日志失败。', 'error', page);
    },
    async openBackup(page) {
      const path = this.lastBackups[page] || '';
      if (!path || !this.api.open_backup) return this.toast('当前任务暂无可打开的备份。', 'warning', page);
      const ok = await this.api.open_backup(path);
      if (!ok) this.toast('打开备份失败。', 'error', page);
    },

    beginTaskUi(page, message) {
      const targetPage = this.logAliases[page] || page;
      this.logs[targetPage] = [];
      if (this.resultTexts) this.resultTexts[targetPage] = '';
      this.progressState[targetPage] = { current: 0, total: 1 };
      if (this.taskStore) this.taskStore.begin(targetPage, message || '任务启动中...');
      this.setProgress(targetPage, 0, 1);
      this.setTaskStatus(targetPage, message || '任务启动中...', 'info');
      this.setTaskSummary(targetPage, '暂无', 'info');
      const box = document.getElementById(`${targetPage}Log`);
      if (box) {
        box.innerHTML = '';
        box.classList.toggle('result-text', this.activeResultModes?.[targetPage] === 'chapter_text');
      }
    },
    setTaskStatus(page, message, level = 'info') {
      const targetPage = this.logAliases[page] || page;
      const text = String(message || '').trim();
      if (!text) return;
      this.taskStatus[targetPage] = { message: text, level };
      this.renderTaskMetrics(targetPage);
      const node = document.getElementById(`${targetPage}Status`);
      if (node) {
        const cssLevel = level === 'warning' ? 'warn' : level;
        node.className = `terminal-status ${cssLevel}`;
        node.textContent = text;
      }
      if (targetPage === this.currentPage) {
        const headerLevel = level === 'error' ? 'error' : (level === 'success' ? 'ready' : 'busy');
        const headerText = level === 'error' ? '任务失败' : (level === 'success' ? '任务完成' : '任务运行中');
        this.setHeaderStatus(headerText, headerLevel);
      }
    },
    setTaskSummary(page, summary, level = 'info') {
    },
    conciseTaskMessage(message, page = '') {
      const text = String(message || '').trim();
      if (!text) return '';
      if (text.startsWith('详细日志：')) return '';
      if (text.startsWith('开始：')) return '';
      if (text.startsWith('准备执行：')) {
        return text.replace(/^准备执行：/, '');
      }
      return text;
    },

    async copyOutput(page) {
      const resultText = String(this.resultTexts?.[page] || '').trim();
      const logText = (document.getElementById(`${page}Log`)?.innerText || '').trim();
      const statusText = (document.getElementById(`${page}Status`)?.innerText || '').trim();
      const text = resultText || logText || statusText;
      if (!text) return this.toast('暂无可复制内容。', 'warning', page);
      try {
        await navigator.clipboard.writeText(text);
        this.toast('已复制。', 'success', page);
      } catch (_) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
        this.toast('已复制。', 'success', page);
      }
    },
    applyTaskEvent(event) {
      const page = event && event.page ? event.page : this.currentPage;
      const targetPage = this.logAliases[page] || page;
      const state = this.taskStore ? this.taskStore.applyEvent(event || {}) : null;
      const progress = event && event.payload && event.payload.progress;
      if (progress) this.setProgress(targetPage, progress.current, progress.total);
      this.renderTaskMetrics(targetPage, state);
      if (event && event.eventType === 'progress') return;
      const text = event && event.displayMessage ? event.displayMessage : (event && event.label && event.message ? `${event.label}：${event.message}` : event && event.message);
      this.appendLog(targetPage, text, event && event.level || 'info');
    },
    renderTaskMetrics(page, state = null) {
      const targetPage = this.logAliases[page] || page;
      if (state && this.taskStore) this.taskStore.states[targetPage] = state;
    },
    appendLog(page, message, level = 'info') {
      const targetPage = this.logAliases[page] || page;
      const normalizedLevel = level === 'warning' ? 'warn' : level;
      const text = this.conciseTaskMessage(message, targetPage);
      if (!text) return;
      this.setTaskStatus(targetPage, text, normalizedLevel);
      if (this.isLoglessPage(targetPage)) return;
      if (!this.logs[targetPage]) this.logs[targetPage] = [];
      const item = { message: text, level: normalizedLevel, time: new Date().toLocaleTimeString() };
      const last = this.logs[targetPage].slice(-1)[0];
      if (last && last.message === item.message && last.level === item.level) return;
      this.logs[targetPage].push(item);
      const box = document.getElementById(`${targetPage}Log`);
      if (!box) return;
      const line = document.createElement('div');
      line.className = `log-line ${normalizedLevel}`;
      line.textContent = text;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    },
    restoreLog(page) {
      const box = document.getElementById(`${page}Log`);
      const status = this.taskStatus[page];
      const statusNode = document.getElementById(`${page}Status`);
      if (statusNode) {
        statusNode.textContent = status?.message || '等待执行';
        const cssLevel = status?.level === 'warning' ? 'warn' : (status?.level || 'info');
        statusNode.className = `terminal-status ${cssLevel}`;
      }
      const progress = this.progressState[page];
      if (progress) this.setProgress(page, progress.current, progress.total);
      this.renderTaskMetrics(page);
      if (!box) return;
      box.innerHTML = '';
      box.classList.remove('result-text');
      if (this.resultTexts?.[page]) {
        this.showResultText(page, this.resultTexts[page]);
        return;
      }
      (this.logs[page] || []).forEach((item) => {
        const line = document.createElement('div');
        line.className = `log-line ${item.level}`;
        line.textContent = item.message;
        box.appendChild(line);
      });
      if (!box.innerHTML && this.activeResultModes?.[page] === 'chapter_text') box.innerHTML = '';
      box.scrollTop = box.scrollHeight;
    },
    clearOutput(page) {
      this.logs[page] = [];
      if (this.resultTexts) this.resultTexts[page] = '';
      if (this.activeResultModes) this.activeResultModes[page] = '';
      this.progressState[page] = { current: 0, total: 0 };
      if (this.taskStore) this.taskStore.begin(page, '等待执行');
      this.setProgress(page, 0, 0);
      this.setTaskStatus(page, '等待执行', 'info');
      this.setTaskSummary(page, '暂无', 'info');
      const box = document.getElementById(`${page}Log`);
      if (box) {
        box.classList.remove('result-text');
        box.innerHTML = '';
      }
    },
    showResultText(page, text) {
      const targetPage = this.logAliases[page] || page;
      const box = document.getElementById(`${targetPage}Log`);
      if (!box) return;
      box.innerHTML = '';
      box.classList.add('result-text');
      box.textContent = String(text || '');
      box.scrollTop = 0;
    },
    setProgress(page, current, total) {
      const targetPage = this.logAliases[page] || page;
      const totalValue = Math.max(0, Number(total || 0));
      const rawCurrent = Math.max(0, Number(current || 0));
      const currentValue = totalValue > 0 ? Math.min(rawCurrent, totalValue) : rawCurrent;
      const percent = totalValue > 0 ? Math.max(0, Math.min(100, Math.round((currentValue / totalValue) * 100))) : 0;
      this.progressState[targetPage] = { current: currentValue, total: totalValue };
      if (this.taskStore) this.taskStore.setProgress(targetPage, currentValue, totalValue);
      const displayTotal = totalValue > 0 ? Math.ceil(totalValue) : 0;
      const displayCurrent = totalValue > 0 ? (currentValue <= 0 ? 0 : Math.min(displayTotal, Math.ceil(currentValue))) : 0;
      const text = document.getElementById(`${targetPage}ProgressText`);
      const bar = document.getElementById(`${targetPage}ProgressBar`);
      const track = document.getElementById(`${targetPage}ProgressTrack`);
      const percentText = document.getElementById(`${targetPage}ProgressPercent`);
      if (text) text.textContent = `${displayCurrent}/${displayTotal}`;
      if (bar) bar.style.width = `${percent}%`;
      if (percentText) percentText.textContent = `${percent}%`;
      if (track) track.classList.toggle('running', percent > 0 && percent < 100);
      this.renderTaskMetrics(targetPage);
    },
    taskDone(page, ok, result) {
      const targetPage = this.logAliases[page] || page;
      const message = result && result.message ? result.message : (ok ? '任务完成' : '任务失败');
      const state = this.progressState[targetPage] || { current: 0, total: 1 };
      if (ok) this.setProgress(targetPage, state.total || 1, state.total || 1);
      if (result && result.path) this.lastOutputs[targetPage] = result.path;
      if (result && result.backupPath) this.lastBackups[targetPage] = result.backupPath;
      else if (result && result.backupDir) this.lastBackups[targetPage] = result.backupDir;
      else if (result && Array.isArray(result.backupPaths) && result.backupPaths.length) this.lastBackups[targetPage] = result.backupPaths[result.backupPaths.length - 1];

      const finalMessage = ok ? message : `${message}（详情见对应 tasklogs 目录）`;
      if (this.taskStore) this.taskStore.finish(targetPage, ok, finalMessage);
      this.setTaskStatus(targetPage, finalMessage, ok ? 'success' : 'error');
      this.resultTexts[targetPage] = finalMessage;
      this.setTaskSummary(targetPage, finalMessage, ok ? 'success' : 'error');

      const resultDisplayMode = result && result.resultDisplayMode ? String(result.resultDisplayMode) : '';
      const resultText = result && result.resultText ? String(result.resultText) : '';
      if (ok && resultDisplayMode === 'chapter_text') {
        this.activeResultModes[targetPage] = 'chapter_text';
        this.resultTexts[targetPage] = resultText;
        this.showResultText(targetPage, resultText);
        return;
      }

      this.resultTexts[targetPage] = '';
      const box = document.getElementById(`${targetPage}Log`);
      if (box) {
        box.classList.remove('result-text');
        box.innerHTML = '';
      }
    },
    toast(message, level = 'info', page = this.currentPage) {
      const text = String(message || '').trim();
      if (!text) return;
      if (this.isLoglessPage(page) && text === '已复制。') return;
      this.appendLog(page, text, level);
    }
  };
})();

(function () {
  window.NovelFanqieAccountMethods = {
    renderFanqieLoginStateRow(prefix, cfg = {}) {
      return `<div class="field fanqie-login-state-row">
        <label>登录状态</label>
        ${this.filePicker(`${prefix}AuthStatePath`, cfg.authStatePath || '', `${prefix}ChooseAuthState`, '默认 state.json')}
      </div>`;
    },
    bindFanqiePickerMenu(button, picker, options, onSelect) {
      if (!button || !picker || picker.dataset.fanqiePickerBound === '1') return;
      picker.dataset.fanqiePickerBound = '1';
      picker.classList.add('source-file-picker');
      button.classList.add('source-picker-toggle');
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<span>选择</span><span class="source-picker-caret" aria-hidden="true">▾</span>';

      const menu = document.createElement('div');
      menu.className = 'source-picker-menu';
      menu.setAttribute('role', 'menu');
      menu.hidden = true;

      options.forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'menuitem');
        item.dataset.pickerValue = option.value;
        item.textContent = option.title;
        menu.appendChild(item);
      });
      picker.appendChild(menu);

      const closeMenu = () => {
        menu.hidden = true;
        picker.classList.remove('source-picker-open');
        button.setAttribute('aria-expanded', 'false');
      };
      const openMenu = () => {
        document.querySelectorAll('.source-file-picker.source-picker-open').forEach((other) => {
          if (other !== picker && typeof other._fanqieClosePicker === 'function') {
            other._fanqieClosePicker();
          }
        });
        menu.hidden = false;
        picker.classList.add('source-picker-open');
        button.setAttribute('aria-expanded', 'true');
      };
      picker._fanqieClosePicker = closeMenu;

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menu.hidden) openMenu();
        else closeMenu();
      });
      menu.addEventListener('click', async (event) => {
        const option = event.target.closest('[data-picker-value]');
        if (!option) return;
        event.stopPropagation();
        closeMenu();
        await onSelect(option.dataset.pickerValue);
      });

      if (!this._fanqiePickerDocumentHandlersBound) {
        document.addEventListener('click', (event) => {
          document.querySelectorAll('.source-file-picker.source-picker-open').forEach((activePicker) => {
            if (!activePicker.contains(event.target) && typeof activePicker._fanqieClosePicker === 'function') {
              activePicker._fanqieClosePicker();
            }
          });
        });
        document.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape') return;
          document.querySelectorAll('.source-file-picker.source-picker-open').forEach((activePicker) => {
            if (typeof activePicker._fanqieClosePicker === 'function') activePicker._fanqieClosePicker();
          });
        });
        this._fanqiePickerDocumentHandlersBound = true;
      }
    },
    bindFanqieLoginStateControls(prefix, configPath) {
      const inputId = `${prefix}AuthStatePath`;
      const button = document.getElementById(`${prefix}ChooseAuthState`);
      const picker = button?.closest('.file-picker');
      if (!button || !picker) return;

      this.bindFanqiePickerMenu(button, picker, [
        {
          value: 'file',
          title: '选择 state.json',
        },
        {
          value: 'folder',
          title: '选择状态目录',
        },
        {
          value: 'default',
          title: '使用默认 state.json',
        },
      ], async (kind) => {
        let path = '';
        if (kind === 'file') {
          path = await this.api.choose_file(configPath, false, 'state.json');
          if (!path) return;
        } else if (kind === 'folder') {
          path = await this.api.choose_folder(configPath);
          if (!path) return;
        } else if (kind !== 'default') {
          return;
        }

        this.setConfigValue(configPath, path);
        this.updateFilePicker(inputId, path, '默认 state.json');
        await this.persistPageConfig(this.currentPage);
      });
    },
  };
})();
(function () {
  window.NovelFanqieTaskMethods = {
    bindAutoPublishPage() {
      this.bindChooseSource('apChooseNovel', 'auto_publish.novelFile', 'apNovelFile', '选择小说来源');
      document.querySelectorAll('[data-auto-op]').forEach((button) => button.addEventListener('click', () => this.runAutoPublish(button.dataset.autoOp)));
      document.getElementById('apStop')?.addEventListener('click', () => this.stopTask('auto_publish_stop', 'auto_publish'));
      document.getElementById('apPause')?.addEventListener('click', () => this.stopTask('auto_publish_pause', 'auto_publish'));
      document.getElementById('apResume')?.addEventListener('click', () => this.stopTask('auto_publish_resume', 'auto_publish'));
      this.bindFanqieLoginStateControls('ap', 'auto_publish.authStatePath');
      this.bindManualScheduleToggle('ap');
    },
    async runAutoPublish(operation) {
      const payload = this.collectPublishPayload('ap', operation);
      this.state.config.auto_publish = payload;
      await this.saveConfig();
      this.beginTaskUi('auto_publish', '准备启动番茄发布...');
      const ok = await this.api.auto_publish_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', 'auto_publish');
    },

    bindChapterSyncPage() {
      this.bindChooseSource('syChooseNovel', 'chapter_sync.novelFile', 'syNovelFile', '选择小说来源');
      document.querySelectorAll('[data-sync-op]').forEach((button) => button.addEventListener('click', () => this.runChapterSync(button.dataset.syncOp)));
      document.getElementById('syStop')?.addEventListener('click', () => this.stopTask('chapter_sync_stop', 'chapter_sync'));
      document.getElementById('syPause')?.addEventListener('click', () => this.stopTask('chapter_sync_pause', 'chapter_sync'));
      document.getElementById('syResume')?.addEventListener('click', () => this.stopTask('chapter_sync_resume', 'chapter_sync'));
      document.getElementById('syPullStop')?.addEventListener('click', () => this.stopTask('chapter_sync_stop', 'chapter_sync'));
      document.getElementById('syPullPause')?.addEventListener('click', () => this.stopTask('chapter_sync_pause', 'chapter_sync'));
      document.getElementById('syPullResume')?.addEventListener('click', () => this.stopTask('chapter_sync_resume', 'chapter_sync'));
      this.bindFanqieLoginStateControls('sy', 'chapter_sync.authStatePath');
      this.bindManualScheduleToggle('sy');
    },
    async runChapterSync(operation) {
      const payload = this.collectPublishPayload('sy', operation);
      this.state.config.chapter_sync = payload;
      await this.saveConfig();
      this.beginTaskUi('chapter_sync', '准备启动番茄同步...');
      const ok = await this.api.chapter_sync_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', 'chapter_sync');
    },
    bindManualScheduleToggle(prefix) {
      const checkbox = document.getElementById(`${prefix}ManualSchedule`);
      const fields = document.getElementById(`${prefix}ManualScheduleFields`);
      const sync = () => fields?.classList.toggle('hidden', !checkbox?.checked);
      checkbox?.addEventListener('change', sync);
      sync();
    },
    bindChooseSource(buttonId, configPath, inputId, emptyText, afterChoose) {
      const button = document.getElementById(buttonId);
      const picker = button?.closest('.file-picker');
      if (!button || !picker) return;

      this.bindFanqiePickerMenu(button, picker, [
        {
          value: 'file',
          title: '选择小说文件',
        },
        {
          value: 'folder',
          title: '选择章节文件夹',
        },
      ], async (kind) => {
        let path = '';
        if (kind === 'folder') {
          path = await this.api.choose_folder(configPath);
        } else if (kind === 'file') {
          path = await this.api.choose_file(configPath, false, '');
        }
        if (!path) return;
        this.setConfigValue(configPath, path);
        this.updateFilePicker(inputId, path, emptyText);
        if (afterChoose) await afterChoose(path);
        await this.persistPageConfig(this.currentPage);
      });
    },
    collectPublishPayload(prefix, operation) {
      return {
        novelFile: document.getElementById(`${prefix}NovelFile`)?.value || '',
        chapterManageUrl: document.getElementById(`${prefix}Url`)?.value || '',
        authStatePath: document.getElementById(`${prefix}AuthStatePath`)?.value || '',
        start: Number(document.getElementById(`${prefix}Start`)?.value || 1),
        end: Number(document.getElementById(`${prefix}End`)?.value || 1),
        useAi: !!document.getElementById(`${prefix}UseAi`)?.checked,
        verifyAfterPublish: !!document.getElementById(`${prefix}VerifyAfterPublish`)?.checked,
        debugScreenshots: !!document.getElementById(`${prefix}DebugScreenshots`)?.checked,
        failureScreenshots: !!document.getElementById(`${prefix}FailureScreenshots`)?.checked,
        gitTracking: !!document.getElementById(`${prefix}GitTracking`)?.checked,
        manualSchedule: !!document.getElementById(`${prefix}ManualSchedule`)?.checked,
        scheduleStartDate: document.getElementById(`${prefix}ScheduleStartDate`)?.value || '',
        scheduleMorningTime: document.getElementById(`${prefix}ScheduleMorningTime`)?.value || '10:00',
        scheduleMorningCount: Number(document.getElementById(`${prefix}ScheduleMorningCount`)?.value || 1),
        scheduleAfternoonTime: document.getElementById(`${prefix}ScheduleAfternoonTime`)?.value || '18:00',
        scheduleAfternoonCount: Number(document.getElementById(`${prefix}ScheduleAfternoonCount`)?.value || 0),
        operation,
      };
    },
  };
})();


// --- assets/pages/fanqie_syncer.js ---
window.renderFanqieSyncerPage = function renderFanqieSyncerPage(app) {
  const cfg = app.state.config.chapter_sync || {};
  return `
    <section class="page active" data-page="chapter_sync">
      <div class="fanqie-task-grid">
        <div class="fanqie-settings-card">
          <div class="settings-body">
            <div class="form-grid fanqie-form">
              <div class="field">
                <label>小说来源</label>
                ${app.filePicker('syNovelFile', cfg.novelFile || '', 'syChooseNovel', '选择小说来源')}
              </div>
              <div class="field">
                <label>章节管理 URL</label>
                <input class="input" id="syUrl" value="${app.attr(cfg.chapterManageUrl || '')}" placeholder="https://fanqienovel.com/..." />
              </div>
              ${app.renderFanqieLoginStateRow ? app.renderFanqieLoginStateRow('sy', cfg) : ''}
              <div class="field-pair">
                <div class="field"><label>起始章节</label><input class="input" id="syStart" type="number" min="1" value="${app.attr(cfg.start || 1)}" /></div>
                <div class="field"><label>结束章节</label><input class="input" id="syEnd" type="number" min="1" value="${app.attr(cfg.end || 1)}" /></div>
              </div>
              <div class="group-label">同步选项</div>
              <div class="option-grid two-col fanqie-option-grid">
                <label><input type="checkbox" id="syUseAi" ${cfg.useAi ? 'checked' : ''}/> 使用 AI</label>
                <label><input type="checkbox" id="syVerifyAfterPublish" ${cfg.verifyAfterPublish !== false ? 'checked' : ''}/> 列表校验</label>
                <label><input type="checkbox" id="syDebugScreenshots" ${cfg.debugScreenshots !== false ? 'checked' : ''}/> 步骤截图</label>
                <label><input type="checkbox" id="syFailureScreenshots" ${cfg.failureScreenshots !== false ? 'checked' : ''}/> 失败截图</label>
                <label><input type="checkbox" id="syGitTracking" ${cfg.gitTracking !== false ? 'checked' : ''}/> Git追踪</label>
                <label><input type="checkbox" id="syManualSchedule" ${cfg.manualSchedule ? 'checked' : ''}/> 手动定时</label>
              </div>
              <div class="manual-schedule-fields ${cfg.manualSchedule ? '' : 'hidden'}" id="syManualScheduleFields">
                <div class="field schedule-date-field"><label>起始日期</label><input class="input" id="syScheduleStartDate" type="date" value="${app.attr(cfg.scheduleStartDate || '')}" /></div>
                <div class="schedule-time-grid">
                  <div class="field"><label>上午时间</label><input class="input" id="syScheduleMorningTime" type="time" value="${app.attr(cfg.scheduleMorningTime || '10:00')}" /></div>
                  <div class="field"><label>上午章数</label><input class="input" id="syScheduleMorningCount" type="number" min="0" value="${app.attr(cfg.scheduleMorningCount || 1)}" /></div>
                  <div class="field"><label>下午时间</label><input class="input" id="syScheduleAfternoonTime" type="time" value="${app.attr(cfg.scheduleAfternoonTime || '18:00')}" /></div>
                  <div class="field"><label>下午章数</label><input class="input" id="syScheduleAfternoonCount" type="number" min="0" value="${app.attr(cfg.scheduleAfternoonCount || 0)}" /></div>
                </div>
              </div>
              <div class="group-label">执行操作</div>
              <div class="action-stack fanqie-actions">
                <div class="action-row two-actions">
                  <button class="big-action primary-action" data-sync-op="publish"><span>↑</span><div><b>开始同步</b></div></button>
                  <button class="big-action primary-action" id="syPause" type="button"><span>⏸</span><div><b>暂缓同步</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" id="syResume" type="button"><span>▶</span><div><b>继续同步</b></div></button>
                  <button class="big-action primary-action" id="syStop" type="button"><span>×</span><div><b>终止同步</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" data-sync-op="pull"><span>↓</span><div><b>开始拉取</b></div></button>
                  <button class="big-action primary-action" id="syPullPause" type="button"><span>⏸</span><div><b>暂缓拉取</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" id="syPullResume" type="button"><span>▶</span><div><b>继续拉取</b></div></button>
                  <button class="big-action primary-action" id="syPullStop" type="button"><span>×</span><div><b>终止拉取</b></div></button>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${app.renderTerminalPanel('chapter_sync')}
      </div>
    </section>
  `;
};


// --- assets/pages/fanqie_publisher.js ---
window.renderFanqiePublisherPage = function renderFanqiePublisherPage(app) {
  const cfg = app.state.config.auto_publish || {};
  return `
    <section class="page active" data-page="auto_publish">
      <div class="fanqie-task-grid">
        <div class="fanqie-settings-card">
          <div class="settings-body">
            <div class="form-grid fanqie-form">
              <div class="field">
                <label>小说来源</label>
                ${app.filePicker('apNovelFile', cfg.novelFile || '', 'apChooseNovel', '选择小说来源')}
              </div>
              <div class="field">
                <label>章节管理 URL</label>
                <input class="input" id="apUrl" value="${app.attr(cfg.chapterManageUrl || '')}" placeholder="https://fanqienovel.com/..." />
              </div>
              ${app.renderFanqieLoginStateRow ? app.renderFanqieLoginStateRow('ap', cfg) : ''}
              <div class="field-pair">
                <div class="field"><label>起始章节</label><input class="input" id="apStart" type="number" min="1" value="${app.attr(cfg.start || 1)}" /></div>
                <div class="field"><label>结束章节</label><input class="input" id="apEnd" type="number" min="1" value="${app.attr(cfg.end || 1)}" /></div>
              </div>
              <div class="group-label">发布选项</div>
              <div class="option-grid two-col fanqie-option-grid">
                <label><input type="checkbox" id="apUseAi" ${cfg.useAi ? 'checked' : ''}/> 使用 AI</label>
                <label><input type="checkbox" id="apVerifyAfterPublish" ${cfg.verifyAfterPublish !== false ? 'checked' : ''}/> 列表校验</label>
                <label><input type="checkbox" id="apDebugScreenshots" ${cfg.debugScreenshots !== false ? 'checked' : ''}/> 步骤截图</label>
                <label><input type="checkbox" id="apFailureScreenshots" ${cfg.failureScreenshots !== false ? 'checked' : ''}/> 失败截图</label>
                <label><input type="checkbox" id="apGitTracking" ${cfg.gitTracking !== false ? 'checked' : ''}/> Git追踪</label>
                <label><input type="checkbox" id="apManualSchedule" ${cfg.manualSchedule ? 'checked' : ''}/> 手动定时</label>
              </div>
              <div class="manual-schedule-fields ${cfg.manualSchedule ? '' : 'hidden'}" id="apManualScheduleFields">
                <div class="field schedule-date-field"><label>起始日期</label><input class="input" id="apScheduleStartDate" type="date" value="${app.attr(cfg.scheduleStartDate || '')}" /></div>
                <div class="schedule-time-grid">
                  <div class="field"><label>上午时间</label><input class="input" id="apScheduleMorningTime" type="time" value="${app.attr(cfg.scheduleMorningTime || '10:00')}" /></div>
                  <div class="field"><label>上午章数</label><input class="input" id="apScheduleMorningCount" type="number" min="0" value="${app.attr(cfg.scheduleMorningCount || 1)}" /></div>
                  <div class="field"><label>下午时间</label><input class="input" id="apScheduleAfternoonTime" type="time" value="${app.attr(cfg.scheduleAfternoonTime || '18:00')}" /></div>
                  <div class="field"><label>下午章数</label><input class="input" id="apScheduleAfternoonCount" type="number" min="0" value="${app.attr(cfg.scheduleAfternoonCount || 0)}" /></div>
                </div>
              </div>
              <div class="group-label">执行操作</div>
              <div class="action-stack fanqie-actions">
                <div class="action-row two-actions">
                  <button class="big-action primary-action" data-auto-op="publish"><span>↑</span><div><b>启动发布</b></div></button>
                  <button class="big-action primary-action" id="apPause" type="button"><span>⏸</span><div><b>暂缓发布</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" id="apResume" type="button"><span>▶</span><div><b>继续发布</b></div></button>
                  <button class="big-action primary-action" id="apStop" type="button"><span>×</span><div><b>终止发布</b></div></button>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${app.renderTerminalPanel('auto_publish')}
      </div>
    </section>
  `;
};


// --- assets/app.js ---
(function () {
  const { pageTitles, defaultPage } = window.NovelConstants;

  const app = {
    state: { config: {}, paths: {}, platforms: {} },
    currentPage: defaultPage,
    hasUserSelectedPage: false,
    api: null,
    logs: {
      auto_publish: [],
      chapter_sync: [],
    },
    logAliases: {},
    lastOutputs: {},
    lastBackups: {},
    taskStatus: {},
    progressState: {},
    taskStore: window.NovelTaskStateStore ? window.NovelTaskStateStore.create() : null,
    activeResultModes: {},
    resultTexts: {},
    saveTimer: null,
    statusOnlyPages: ['auto_publish', 'chapter_sync'],
    loglessPages: ['auto_publish', 'chapter_sync'],

    isStatusOnlyPage(page) { const targetPage = this.logAliases[page] || page; return this.statusOnlyPages.includes(targetPage); },
    isLoglessPage(page) { const targetPage = this.logAliases[page] || page; return this.loglessPages.includes(targetPage); },
    setHeaderStatus(message, level = 'ready') {
      const badge = document.getElementById('statusBadge');
      if (!badge) return;
      const text = String(message || '就绪').trim() || '就绪';
      badge.className = `status-badge ${level === 'busy' ? 'busy' : level === 'error' ? 'error' : ''}`.trim();
      badge.innerHTML = `<i></i> ${this.escape(text)}`;
    },
    ...window.NovelUiMethods,
    ...window.NovelTaskPanelMethods,
    ...window.NovelFanqieAccountMethods,
    ...window.NovelFanqieTaskMethods,
    setConfigValue(path, value) {
      if (!path) return;
      const parts = String(path).split('.').filter(Boolean);
      let cursor = this.state.config;
      parts.slice(0, -1).forEach((part) => {
        if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {};
        cursor = cursor[part];
      });
      if (parts.length) cursor[parts[parts.length - 1]] = value;
    },
    debounceSavePage(page) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => this.persistPageConfig(page), 350);
    },
    async persistPageConfig(page) {
      try {
        if (page === 'auto_publish') {
          this.state.config.auto_publish = this.collectPublishPayload('ap', this.state.config.auto_publish?.operation || 'publish');
        } else if (page === 'chapter_sync') {
          this.state.config.chapter_sync = this.collectPublishPayload('sy', this.state.config.chapter_sync?.operation || 'publish');
        }
        this.state.config.activePage = this.currentPage;
        await this.api.save_config(this.state.config);
      } catch (error) {
        console.debug('save config failed', error);
      }
    },
    bindFormAutosave(page) {
      const root = document.querySelector(`[data-page="${page}"] .fanqie-settings-card`);
      if (!root) return;
      const handler = () => this.debounceSavePage(page);
      root.addEventListener('input', handler);
      root.addEventListener('change', handler);
    },
    async init() {
      await this.waitForApi();
      this.state = await this.api.get_state();
      this.currentPage = pageTitles[this.state.config.activePage] ? this.state.config.activePage : defaultPage;
      this.bindShell();
      this.render();
    },
    waitForApi() {
      return new Promise((resolve) => {
        const ready = () => {
          this.api = window.pywebview && window.pywebview.api;
          if (this.api) resolve();
        };
        if (window.pywebview && window.pywebview.api) return ready();
        window.addEventListener('pywebviewready', ready, { once: true });
      });
    },
    bindShell() {
      const brandButton = document.getElementById('brandButton');
      const pageMenu = document.getElementById('pageMenu');
      const switchPage = (event) => {
        const button = event.target.closest('[data-page]');
        if (!button) return;
        pageMenu?.classList.remove('open');
        brandButton?.setAttribute('aria-expanded', 'false');
        this.hasUserSelectedPage = true;
        this.go(button.dataset.page);
      };
      brandButton?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = pageMenu?.classList.toggle('open');
        brandButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
      pageMenu?.addEventListener('click', switchPage);
      document.addEventListener('click', () => {
        pageMenu?.classList.remove('open');
        brandButton?.setAttribute('aria-expanded', 'false');
      });
      document.getElementById('loginButton')?.addEventListener('click', async () => {
        if (!this.api.reset_login) return;
        this.setHeaderStatus('正在重置授权...', 'busy');
        try {
          const result = await this.api.reset_login();
          this.setHeaderStatus(result && result.ok ? '授权已清除' : '授权清理失败', result && result.ok ? 'ready' : 'error');
        } catch (error) {
          console.debug('reset login failed', error);
          this.setHeaderStatus('授权清理失败', 'error');
        }
      });
      document.getElementById('resetDataButton')?.addEventListener('click', async () => {
        if (!this.api.reset_app_data) return;
        this.setHeaderStatus('正在重置数据...', 'busy');
        try {
          const result = await this.api.reset_app_data();
          this.state = await this.api.get_state();
          this.currentPage = pageTitles[this.state.config.activePage] ? this.state.config.activePage : defaultPage;
          this.logs = {
            auto_publish: [],
            chapter_sync: [],
          };
          this.lastOutputs = {};
          this.lastBackups = {};
          this.taskStatus = {};
          this.progressState = {};
          this.taskStore = window.NovelTaskStateStore ? window.NovelTaskStateStore.create() : null;
          this.activeResultModes = {};
          this.resultTexts = {};
          this.render();
          this.setHeaderStatus(result && result.ok ? '数据已重建' : '重建失败', result && result.ok ? 'ready' : 'error');
        } catch (error) {
          console.debug('reset data failed', error);
          this.setHeaderStatus('重建失败', 'error');
        }
      });
      this.bindThemeControls();
      document.body.addEventListener('click', async (event) => {
        const copy = event.target.closest('[data-copy-output]');
        if (copy) this.copyOutput(copy.dataset.copyOutput);
        const clear = event.target.closest('[data-clear-output]');
        if (clear) this.clearOutput(clear.dataset.clearOutput);
        const openOutput = event.target.closest('[data-open-output]');
        if (openOutput) await this.openOutputDir(openOutput.dataset.openOutput);
        const openLog = event.target.closest('[data-open-log]');
        if (openLog) await this.openTaskLog(openLog.dataset.openLog);
        const openBackup = event.target.closest('[data-open-backup]');
        if (openBackup) await this.openBackup(openBackup.dataset.openBackup);
      });
    },
    bindThemeControls() {
      const modal = document.getElementById('themeModal');
      document.getElementById('themeButton')?.addEventListener('click', () => modal?.classList.add('open'));
      document.getElementById('themeClose')?.addEventListener('click', () => modal?.classList.remove('open'));
      modal?.addEventListener('click', (event) => {
        if (event.target === modal) modal.classList.remove('open');
      });
      document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => {
        const theme = button.dataset.theme || 'blue';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }));
      document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'blue');
    },
    async saveConfig() {
      this.state.config.activePage = this.currentPage;
      await this.api.save_config(this.state.config);
    },
    async go(page) {
      this.currentPage = pageTitles[page] ? page : defaultPage;
      this.render();
      await this.saveConfig();
    },
    render() {
      const [, title] = pageTitles[this.currentPage] || pageTitles[defaultPage];
      document.title = this.hasUserSelectedPage ? `${title} - 番茄发布同步助手` : '番茄发布同步助手';
      const brandModeText = document.getElementById('brandModeText');
      if (brandModeText) brandModeText.textContent = this.hasUserSelectedPage ? title : 'LOCAL TOOL';
      document.querySelectorAll('#pageMenu [data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === this.currentPage));
      const renderer = {
        auto_publish: window.renderFanqiePublisherPage,
        chapter_sync: window.renderFanqieSyncerPage,
      }[this.currentPage] || window.renderFanqiePublisherPage;
      document.getElementById('pageHost').innerHTML = renderer(this);
      this.bindPage(this.currentPage);
      this.restorePageLogs();
    },
    restorePageLogs() {
      this.restoreLog(this.currentPage);
    },
    bindPage(page) {
      if (page === 'auto_publish') this.bindAutoPublishPage();
      if (page === 'chapter_sync') this.bindChapterSyncPage();
      this.bindFormAutosave(page);
    },

    async stopTask(apiName, page) {
      if (!this.api[apiName]) return this.toast('当前版本不支持停止任务。', 'warning', page);
      const ok = await this.api[apiName]();
      if (!ok) this.toast('当前没有正在运行的任务。', 'warning', page);
    },

    bindChooseFile(buttonId, configPath, inputId, emptyText, afterChoose, save = false, suggestedName = '') {
      document.getElementById(buttonId)?.addEventListener('click', async () => {
        const filename = typeof suggestedName === 'function' ? suggestedName() : suggestedName;
        const path = await this.api.choose_file(configPath, save, filename || 'output.txt');
        if (!path) return;
        this.setConfigValue(configPath, path);
        this.updateFilePicker(inputId, path, emptyText);
        if (afterChoose) await afterChoose(path);
        await this.persistPageConfig(this.currentPage);
      });
    },
    bindChooseFolder(buttonId, configPath, inputId, emptyText, afterChoose) {
      document.getElementById(buttonId)?.addEventListener('click', async () => {
        const path = await this.api.choose_folder(configPath);
        if (!path) return;
        this.setConfigValue(configPath, path);
        this.updateFilePicker(inputId, path, emptyText);
        if (afterChoose) await afterChoose(path);
        await this.persistPageConfig(this.currentPage);
      });
    },

  };

  window.NovelTools = app;
  app.init().catch((error) => {
    console.error(error);
    document.getElementById('pageHost').innerHTML = `<div class="card"><h2>启动失败</h2><p>${String(error)}</p></div>`;
  });
})();

