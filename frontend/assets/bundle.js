// bundle.js —— 由 tools/bundle_js.py 自动生成，请勿手动编辑


// --- assets/core/page_registry.js ---
(function () {
  window.NovelConstants = {
    pageTitles: {
      auto_publish: ['发布', '番茄发布'],
      chapter_sync: ['同步', '番茄同步'],
      process_novel: ['处理', '小说处理'],
      web_crawler: ['抓取', '网页抓取'],
      character_material: ['角色', '角色素材'],
      current_plot: ['剧情', '当前剧情'],
      webnovel_writer: ['写作', '网文写作'],
    },
    defaultPage: 'process_novel',
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
(function () {
  window.NovelCrawlerOutputMethods = {
    bindCrawlerOutputControls() {
      const cfg = this.state.config.web_crawler || (this.state.config.web_crawler = {});
      const urlInput = document.getElementById('nsUrl');
      const getSuggestedName = () => this.basename(document.getElementById('nsOutput')?.value || '') || 'output.txt';

      this.bindChooseFile(
        'nsChooseOutput',
        'web_crawler.outputFile',
        'nsOutput',
        '自动生成 / 选择文件',
        async (path) => {
          cfg.outputFileManual = true;
          cfg.outputAutoUrl = urlInput?.value || '';
          cfg.outputFile = path;
        },
        true,
        getSuggestedName,
      );

      let timer = null;
      urlInput?.addEventListener('input', () => {
        const nextUrl = (urlInput.value || '').trim();
        if (!cfg.outputFileManual) {
          this.updateFilePicker('nsOutput', '', nextUrl ? '正在解析书名...' : '自动生成 / 选择文件');
        }
        window.clearTimeout(timer);
        timer = window.setTimeout(() => this.refreshCrawlerAutoOutput(false), 650);
      });

      if ((urlInput?.value || '').trim() && !cfg.outputFileManual && !cfg.outputFile) {
        this.refreshCrawlerAutoOutput(false);
      }
    },
    async refreshCrawlerAutoOutput(force = false) {
      const cfg = this.state.config.web_crawler || (this.state.config.web_crawler = {});
      if (cfg.outputFileManual && !force) return;
      const url = (document.getElementById('nsUrl')?.value || '').trim();
      if (!url || !this.api.web_crawler_preview) {
        if (!url) {
          cfg.outputFile = '';
          cfg.outputAutoUrl = '';
          cfg.outputFileManual = false;
          this.updateFilePicker('nsOutput', '', '自动生成 / 选择文件');
        }
        return;
      }
      const token = `${Date.now()}-${Math.random()}`;
      this._crawlerPreviewToken = token;
      try {
        const result = await this.api.web_crawler_preview(url, '');
        if (this._crawlerPreviewToken !== token) return;
        if (result && result.ok && result.outputFile) {
          cfg.outputFileManual = false;
          cfg.outputFile = result.outputFile;
          cfg.outputAutoUrl = url;
          this.updateFilePicker('nsOutput', result.outputFile, '自动生成 / 选择文件');
          await this.persistPageConfig('web_crawler');
        }
      } catch (error) {
        console.debug('web crawler preview failed', error);
      }
    },
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
          const key = String(page || 'process_novel');
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
          const page = String(event && event.page || 'process_novel');
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
      const isWebnovel = (this.logAliases[page] || page) === 'webnovel_writer';
      const actions = isWebnovel
        ? `<button class="terminal-open-log" data-open-log="${this.attr(page)}" type="button">打开日志</button>
            <button class="terminal-open" data-open-output="${this.attr(page)}" type="button">打开目录</button>`
        : `<button class="terminal-clear" data-clear-output="${this.attr(page)}" type="button">清空</button>
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
        process_novel: 'novel_processor',
        process_novel_batch: 'novel_processor',
        novel_splitter: 'novel_processor',
        clean_text_ads: 'novel_processor',
        clean_text_breaks: 'novel_processor',
        auto_publish: 'fanqie_publisher',
        chapter_sync: 'fanqie_syncer',
        character_material: 'character_material',
        current_plot: 'current_plot',
        webnovel_writer: 'webnovel_writer',
      };
      if (featureRootPages[page]) return this.statePath(featureRootPages[page]);
      if (page === 'web_crawler') return document.getElementById('nsOutput')?.value || this.lastOutputs.web_crawler || this.statePath('web_crawler_outputs');
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
      if (page === 'web_crawler') {
        if (/^(抓取|写入|限流|失败)：第\s*\d+\s*章/.test(text)) return text;
        if (/^(目录：读取|读取目录：)/.test(text)) return '正在读取目录...';
        if (/^(目录：完成|目录完成：)/.test(text)) {
          const match = text.match(/本次\s*(\d+)\s*章/);
          return match ? `目录读取完成：本次 ${match[1]} 章。` : '目录读取完成。';
        }
        if (/^(阶段：第一组参数抓取：|开始第一组参数抓取)/.test(text)) return '正在抓取章节...';
        if (/^(阶段：第一组参数抓取完成|第一组参数抓取完成)/.test(text)) return text.includes('失败') ? '第一轮完成，正在补抓失败章节...' : '章节抓取完成，正在写出文件...';
        if (/^(补抓：上一组|上一组完成后仍失败)/.test(text)) return '正在补抓失败章节...';
        if (/^(限流：|触发限流保护)/.test(text)) return '触发限流保护，稍后继续...';
        if (/^正在合并/.test(text)) return '正在合并并写出 TXT 文件...';
        if (/^(完成：TXT|TXT 文件写出完成)/.test(text)) return 'TXT 文件已写出。';
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
      const isCrawlerChapterLine = /^(抓取|写入|限流|失败)：第\s*\d+\s*章/.test(text);
      if (targetPage === 'web_crawler' && !isCrawlerChapterLine) return;
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
      if (targetPage !== 'webnovel_writer' && ok && resultDisplayMode === 'chapter_text') {
        this.activeResultModes[targetPage] = 'chapter_text';
        this.resultTexts[targetPage] = resultText;
        this.showResultText(targetPage, resultText);
        return;
      }

      if (targetPage !== 'webnovel_writer') this.resultTexts[targetPage] = '';
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
      this.bindFanqieLoginStateControls('sy', 'chapter_sync.authStatePath');
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
        cleanBeforeRun: !!document.getElementById(`${prefix}CleanBeforeRun`)?.checked,
        headless: !!document.getElementById(`${prefix}Headless`)?.checked,
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


// --- assets/core/novel_splitter.js ---
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


// --- assets/core/character_material.js ---
(function () {
  window.NovelCharacterMaterialMethods = {
    collectCharacterMaterialConfig() {
      return {
        source: document.getElementById('cmSource')?.value || '',
        outputDir: document.getElementById('cmOutputDir')?.value || '',
        characterTarget: document.getElementById('cmCharacterTarget')?.value || '',
        keyword: document.getElementById('cmKeyword')?.value || '',
        platform: document.getElementById('cmPlatform')?.value || 'deepseek',
        apiKey: document.getElementById('cmApiKey')?.value || '',
        baseUrl: document.getElementById('cmBaseUrl')?.value || '',
        modelName: document.getElementById('cmModelName')?.value || '',
        temperature: Number(document.getElementById('cmTemperature')?.value || 0.2),
        chapter: document.getElementById('cmChapter')?.value || '',
        start: document.getElementById('cmStart')?.value || '',
        end: document.getElementById('cmEnd')?.value || '',
        allChapters: !!document.getElementById('cmAll')?.checked,
        concurrent: !!document.getElementById('cmConcurrent')?.checked,
        maxWorkers: Number(document.getElementById('cmWorkers')?.value || 4),
      };
    },
    bindCharacterMaterialPage() {
      this.bindChooseFile('cmChooseSource', 'character_material.source', 'cmSource', '选择完整小说 TXT');
      this.bindChooseFolder('cmChooseOutputDir', 'character_material.outputDir', 'cmOutputDir', '自动生成 / 选择目录');
      document.getElementById('cmPlatform')?.addEventListener('change', () => this.refreshCharacterMaterialPlatformDefaults());
      document.getElementById('cmRun')?.addEventListener('click', () => this.characterMaterialRun());
      document.getElementById('cmStop')?.addEventListener('click', () => this.stopTask('character_material_stop', 'character_material'));
    },
    async refreshCharacterMaterialPlatformDefaults() {
      if (!this.api.character_material_platform_defaults) return;
      const platform = document.getElementById('cmPlatform')?.value || 'deepseek';
      const result = await this.api.character_material_platform_defaults(platform);
      if (!result || !result.ok) return;
      const base = document.getElementById('cmBaseUrl');
      const model = document.getElementById('cmModelName');
      if (base && !base.value) base.value = result.baseUrl || '';
      if (model && !model.value) model.value = result.modelName || '';
      this.debounceSavePage('character_material');
    },
    async characterMaterialRun() {
      const payload = this.collectCharacterMaterialConfig();
      this.state.config.character_material = payload;
      await this.saveConfig();
      this.beginTaskUi('character_material', '准备按章节抽取角色素材...');
      const ok = await this.api.character_material_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', 'character_material');
    },
  };
})();


// --- assets/core/current_plot.js ---
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

// --- assets/core/webnovel_writer.js ---
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


// --- assets/pages/novel_processor.js ---
window.renderNovelProcessorPage = function renderNovelProcessorPage(app) {
  const processCfg = app.state.config.process_novel || {};
  const cleanTextCfg = app.state.config.clean_text || {};
  const splitCfg = app.state.config.novel_splitter || {};
  const adProfiles = (app.state.adProfiles || [])
    .map(p => `<option value="${app.attr(p.key)}" ${String(cleanTextCfg.adProfile || 'mimiread') === p.key ? 'selected' : ''}>${app.escape(p.name)}</option>`)
    .join('');

  const novelFile = processCfg.novelFile || cleanTextCfg.inputFile || '';
  const batchFolder = processCfg.batchFolder || cleanTextCfg.batchFolder || '';
  const outputFile = processCfg.outputFile || '';
  const adInput = cleanTextCfg.adInputFile || cleanTextCfg.inputFile || novelFile || '';
  const adFolder = cleanTextCfg.adBatchFolder || cleanTextCfg.batchFolder || batchFolder || '';
  const moveInput = cleanTextCfg.moveInputFile || cleanTextCfg.inputFile || novelFile || '';
  const moveFolder = cleanTextCfg.moveBatchFolder || cleanTextCfg.batchFolder || batchFolder || '';
  const splitInput = splitCfg.inputFile || novelFile || '';
  const splitOutput = splitCfg.outputDir || '';
  const splitMode = ['chapter_count', 'size'].includes(splitCfg.splitMode) ? splitCfg.splitMode : 'chapter_count';

  return `
    <section class="page active process-page" data-page="process_novel">
      <div class="process-stack">
        <div class="fanqie-task-grid">
          <div class="fanqie-settings-card">
            <div class="settings-body">
              <div class="form-grid">
                <div class="field">
                  <label>完整小说 TXT</label>
                  ${app.filePicker('exNovelFile', novelFile, 'exChooseNovel', '选择完整小说 TXT')}
                </div>
                <div class="field">
                  <label>章节输出 TXT</label>
                  ${app.filePicker('exOutputFile', outputFile, 'exChooseOutputFile', '自动命名 / 选择输出 TXT')}
                </div>
                <div class="field-pair">
                  <div class="field"><label>单章</label><input class="input" id="exChapter" type="number" min="1" placeholder="章节号" /></div>
                  <div class="field"><label>前后章</label><input class="input" id="exAroundChapter" type="number" min="1" placeholder="当前章" /></div>
                </div>
                <div class="field-pair">
                  <div class="field"><label>范围开始</label><input class="input" id="exStart" type="number" min="1" placeholder="起始章" /></div>
                  <div class="field"><label>范围结束</label><input class="input" id="exEnd" type="number" min="1" placeholder="结束章" /></div>
                </div>
                <div class="group-label">提取</div>
                <div class="action-row three-actions compact-actions">
                  <button class="big-action" data-ex-mode="single" data-ex-log="process_novel"><span>1</span><div><b>提取单章</b></div></button>
                  <button class="big-action" data-ex-mode="around" data-ex-log="process_novel"><span>±</span><div><b>提取前后</b></div></button>
                  <button class="big-action" data-ex-mode="range" data-ex-log="process_novel"><span>↔</span><div><b>提取范围</b></div></button>
                </div>
                <div class="group-label">整理</div>
                <div class="action-row three-actions compact-actions">
                  <button class="big-action" data-ex-mode="organizeSingle" data-ex-log="process_novel"><span>1</span><div><b>整理单章</b></div></button>
                  <button class="big-action" data-ex-mode="organizeAround" data-ex-log="process_novel"><span>±</span><div><b>整理前后</b></div></button>
                  <button class="big-action" data-ex-mode="organizeRange" data-ex-log="process_novel"><span>↔</span><div><b>整理范围</b></div></button>
                </div>
                <button class="big-action primary-action wide-action" data-ex-mode="formatNovel" data-ex-log="process_novel"><span>TXT</span><div><b>格式化整本</b></div></button>
              </div>
            </div>
          </div>
          ${app.renderTerminalPanel('process_novel')}
        </div>


        <div class="fanqie-task-grid">
          <div class="fanqie-settings-card">
            <div class="settings-body">
              <div class="form-grid">
                <div class="field">
                  <label>待分割小说 TXT</label>
                  ${app.filePicker('spInputFile', splitInput, 'spChooseInput', '选择完整小说 TXT')}
                </div>
                <div class="field">
                  <label>分割输出目录</label>
                  ${app.filePicker('spOutputDir', splitOutput, 'spChooseOutput', '自动生成 / 选择目录')}
                </div>
                <div class="field"><label>分割方式</label><select class="select" id="spMode">
                  <option value="chapter_count" ${splitMode === 'chapter_count' ? 'selected' : ''}>按章节数分割</option>
                  <option value="size" ${splitMode === 'size' ? 'selected' : ''}>按大小分割</option>
                </select></div>
                <div class="field-pair">
                  <div class="field"><label>每份章节数</label><input class="input" id="spChaptersPerFile" type="number" min="1" value="${app.attr(splitCfg.chaptersPerFile || 10)}" /></div>
                  <div class="field"><label>每份大小 MB</label><input class="input" id="spMaxSizeMb" type="number" min="0.1" step="0.1" value="${app.attr(splitCfg.maxSizeMb || 5)}" /></div>
                </div>
                <div class="option-grid two-col">
                  <label><input type="checkbox" id="spIncludePrelude" ${splitCfg.includePrelude !== false ? 'checked' : ''}/> 保留正文前内容</label>
                  <label><input type="checkbox" id="spCleanOutput" ${splitCfg.cleanOutput ? 'checked' : ''}/> 清空旧 TXT</label>
                </div>
                <button class="big-action primary-action wide-action" id="spRun"><span>✂</span><div><b>开始分割</b></div></button>
              </div>
            </div>
          </div>
          ${app.renderTerminalPanel('novel_splitter')}
        </div>

        <div class="fanqie-task-grid">
          <div class="fanqie-settings-card">
            <div class="settings-body">
              <div class="form-grid">
                <div class="field">
                  <label>批量稿件文件夹</label>
                  ${app.filePicker('exBatchFolder', batchFolder, 'exChooseBatchFolder', '选择文件夹')}
                </div>
                <div class="option-grid three-col">
                  <label><input type="checkbox" checked disabled/> TXT</label>
                  <label><input type="checkbox" ${processCfg.backup !== false ? 'checked' : ''} disabled/> 备份</label>
                  <label><input type="checkbox" checked disabled/> 批量</label>
                </div>
                <button class="big-action primary-action wide-action" data-ex-mode="formatFolder" data-ex-log="process_novel_batch"><span>DIR</span><div><b>批量格式化</b></div></button>
              </div>
            </div>
          </div>
          ${app.renderTerminalPanel('process_novel_batch')}
        </div>

        <div class="fanqie-task-grid">
          <div class="fanqie-settings-card">
            <div class="settings-body">
              <div class="form-grid">
                <div class="field">
                  <label>待清理 TXT</label>
                  ${app.filePicker('tcAdInput', adInput, 'tcChooseAdInput', '选择 TXT')}
                </div>
                <div class="field">
                  <label>批量清理文件夹</label>
                  ${app.filePicker('tcAdFolder', adFolder, 'tcChooseAdFolder', '选择文件夹')}
                </div>
                <div class="field"><label>广告配置</label><select class="select" id="tcAdProfile">${adProfiles}</select></div>
                <div class="option-grid three-col">
                  <label><input type="checkbox" id="tcAdOverwrite" ${cleanTextCfg.overwrite !== false ? 'checked' : ''}/> 覆盖</label>
                  <label><input type="checkbox" id="tcAdBackup" ${cleanTextCfg.backup !== false ? 'checked' : ''}/> 备份</label>
                  <label><input type="checkbox" checked disabled/> 清广告</label>
                </div>
                <button class="big-action primary-action wide-action" id="tcAdRun"><span>AD</span><div><b>清理广告</b></div></button>
              </div>
            </div>
          </div>
          ${app.renderTerminalPanel('clean_text_ads')}
        </div>

        <div class="fanqie-task-grid">
          <div class="fanqie-settings-card">
            <div class="settings-body">
              <div class="form-grid">
                <div class="field">
                  <label>待修复断行 TXT</label>
                  ${app.filePicker('tcMoveInput', moveInput, 'tcChooseMoveInput', '选择 TXT')}
                </div>
                <div class="field">
                  <label>批量修复断行文件夹</label>
                  ${app.filePicker('tcMoveFolder', moveFolder, 'tcChooseMoveFolder', '选择文件夹')}
                </div>
                <div class="field-pair">
                  <div class="field"><label>移动阈值</label><input class="input" id="tcMaxMoveChars" type="number" min="20" max="2000" value="${app.attr(cleanTextCfg.maxMoveChars || 120)}" /></div>
                  <div class="field"><label>标点处理</label><select class="select" id="tcMovePunctuation"><option value="on" ${cleanTextCfg.normalizePunctuation !== false ? 'selected' : ''}>开启</option><option value="off" ${cleanTextCfg.normalizePunctuation === false ? 'selected' : ''}>关闭</option></select></div>
                </div>
                <div class="option-grid three-col">
                  <label><input type="checkbox" id="tcMoveOverwrite" ${cleanTextCfg.overwrite !== false ? 'checked' : ''}/> 覆盖</label>
                  <label><input type="checkbox" id="tcMoveBackup" ${cleanTextCfg.backup !== false ? 'checked' : ''}/> 备份</label>
                  <label><input type="checkbox" checked disabled/> 修断行</label>
                </div>
                <button class="big-action primary-action wide-action" id="tcMoveRun"><span>↯</span><div><b>修复断行</b></div></button>
              </div>
            </div>
          </div>
          ${app.renderTerminalPanel('clean_text_breaks')}
        </div>
      </div>
    </section>
  `;
};


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
                <label><input type="checkbox" id="syHeadless" ${cfg.headless ? 'checked' : ''}/> 后台无头</label>
                <label><input type="checkbox" id="syDebugScreenshots" ${cfg.debugScreenshots !== false ? 'checked' : ''}/> 步骤截图</label>
                <label><input type="checkbox" id="syFailureScreenshots" ${cfg.failureScreenshots !== false ? 'checked' : ''}/> 失败截图</label>
                <label><input type="checkbox" id="syGitTracking" ${cfg.gitTracking !== false ? 'checked' : ''}/> Git追踪</label>
                <label><input type="checkbox" id="syCleanBeforeRun" ${cfg.cleanBeforeRun !== false ? 'checked' : ''}/> 启动清理</label>
              </div>
              <div class="group-label">执行操作</div>
              <div class="action-stack fanqie-actions">
                <div class="action-row two-actions">
                  <button class="big-action primary-action" data-sync-op="publish"><span>↻</span><div><b>开始同步</b></div></button>
                  <button class="big-action primary-action" id="syStop" type="button"><span>×</span><div><b>停止同步</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" id="syPause" type="button"><span>⏸</span><div><b>暂停</b></div></button>
                  <button class="big-action primary-action" id="syResume" type="button"><span>▶</span><div><b>继续</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" data-sync-op="pull"><span>↓</span><div><b>开始拉取</b></div></button>
                  <button class="big-action primary-action" data-sync-op="compare"><span>≠</span><div><b>打开对比</b></div></button>
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
                <label><input type="checkbox" id="apHeadless" ${cfg.headless ? 'checked' : ''}/> 后台无头</label>
                <label><input type="checkbox" id="apDebugScreenshots" ${cfg.debugScreenshots !== false ? 'checked' : ''}/> 步骤截图</label>
                <label><input type="checkbox" id="apFailureScreenshots" ${cfg.failureScreenshots !== false ? 'checked' : ''}/> 失败截图</label>
                <label><input type="checkbox" id="apGitTracking" ${cfg.gitTracking !== false ? 'checked' : ''}/> Git追踪</label>
                <label><input type="checkbox" id="apCleanBeforeRun" ${cfg.cleanBeforeRun !== false ? 'checked' : ''}/> 启动清理</label>
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
                  <button class="big-action primary-action" id="apStop" type="button"><span>×</span><div><b>停止发布</b></div></button>
                </div>
                <div class="action-row two-actions">
                  <button class="big-action primary-action" id="apPause" type="button"><span>⏸</span><div><b>暂停</b></div></button>
                  <button class="big-action primary-action" id="apResume" type="button"><span>▶</span><div><b>继续</b></div></button>
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


// --- assets/pages/novel_crawler.js ---
window.renderNovelCrawlerPage = function renderNovelCrawlerPage(app) {
  const cfg = app.state.config.web_crawler || {};
  return `
    <section class="page active" data-page="web_crawler">
      <div class="fanqie-task-grid">
        <div class="fanqie-settings-card">
          <div class="settings-body">
            <div class="form-grid">
              <div class="field">
                <label>小说目录链接</label>
                <input class="input" id="nsUrl" value="${app.attr(cfg.novelUrl || '')}" placeholder="https://www.renrenreshu.com/chapter/195857.html 或 http://www.xsbook.org/215_215658/" />
              </div>
              <div class="field">
                <label>输出 TXT</label>
                ${app.filePicker('nsOutput', cfg.outputFile || '', 'nsChooseOutput', '自动生成 / 选择文件')}
              </div>
              <div class="field-pair">
                <div class="field"><label>起始章节</label><input class="input" id="nsStart" type="number" min="1" value="${app.attr(cfg.start || 1)}" /></div>
                <div class="field"><label>结束章节</label><input class="input" id="nsEnd" type="number" min="1" value="${app.attr(cfg.end || '')}" placeholder="留空到最后" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>并发数</label><input class="input" id="nsWorkers" type="number" min="1" max="24" value="${app.attr(cfg.maxWorkers || 16)}" /></div>
                <div class="field"><label>超时秒数</label><input class="input" id="nsTimeout" type="number" min="3" value="${app.attr(cfg.timeout || 25)}" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>最小间隔</label><input class="input" id="nsDelayMin" type="number" min="0" step="0.05" value="${app.attr(cfg.requestDelayMin ?? 0.12)}" /></div>
                <div class="field"><label>最大间隔</label><input class="input" id="nsDelayMax" type="number" min="0" step="0.05" value="${app.attr(cfg.requestDelayMax ?? 0.35)}" /></div>
              </div>
              <div class="field"><label>重试次数</label><input class="input" id="nsRetries" type="number" min="0" value="${app.attr(cfg.maxRetries ?? 3)}" /></div>
              <div class="group-label">抓取选项</div>
              <div class="option-grid two-col">
                <label><input type="checkbox" id="nsHtmlFallback" ${cfg.htmlFallback !== false ? 'checked' : ''}/> HTML 兜底</label>
                <label><input type="checkbox" id="nsDetailedLog" ${cfg.detailedLog ? 'checked' : ''}/> 详细日志</label>
              </div>
              <div class="action-row two-actions">
                <button class="big-action primary-action" id="nsRun"><span>↓</span><div><b>开始拉取</b></div></button>
                <button class="big-action primary-action" id="nsStop" type="button"><span>×</span><div><b>停止爬取</b></div></button>
              </div>
            </div>
          </div>
        </div>
        ${app.renderTerminalPanel('web_crawler')}
      </div>
    </section>
  `;
};


// --- assets/pages/character_material.js ---
window.renderCharacterMaterialPage = function renderCharacterMaterialPage(app) {
  const cfg = app.state.config.character_material || {};
  const platforms = app.state.characterMaterialPlatforms || {};
  const defaults = (app.state.characterMaterialDefaults || {})[cfg.platform || 'deepseek'] || {};
  const platformOptions = Object.entries(platforms).map(([key, label]) => `<option value="${app.attr(key)}" ${String(cfg.platform || 'deepseek') === key ? 'selected' : ''}>${app.escape(label)}</option>`).join('');
  const baseUrl = cfg.baseUrl || defaults.baseUrl || '';
  const modelName = cfg.modelName || defaults.modelName || '';
  return `
    <section class="page active" data-page="character_material">
      <div class="fanqie-task-grid">
        <div class="fanqie-settings-card">
          <div class="settings-body">
            <div class="form-grid">
              <div class="field">
                <label>小说 TXT</label>
                ${app.filePicker('cmSource', cfg.source || '', 'cmChooseSource', '选择完整小说 TXT')}
              </div>
              <div class="field">
                <label>输出目录</label>
                ${app.filePicker('cmOutputDir', cfg.outputDir || '', 'cmChooseOutputDir', '自动生成 / 选择目录')}
              </div>
              <div class="field"><label>模型平台</label><select class="select" id="cmPlatform">${platformOptions}</select></div>
              <div class="field"><label>API Key</label><input class="input" id="cmApiKey" type="password" value="${app.attr(cfg.apiKey || '')}" placeholder="可留空，读取环境变量" /></div>
              <div class="field"><label>Base URL</label><input class="input" id="cmBaseUrl" value="${app.attr(baseUrl)}" placeholder="OpenAI 兼容接口地址" /></div>
              <div class="field-pair">
                <div class="field"><label>模型名称</label><input class="input" id="cmModelName" value="${app.attr(modelName)}" placeholder="deepseek-v4-flash / gpt-4o-mini" /></div>
                <div class="field"><label>温度</label><input class="input" id="cmTemperature" type="number" min="0" max="2" step="0.1" value="${app.attr(cfg.temperature ?? 0.2)}" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>人物 / 对象</label><input class="input" id="cmCharacterTarget" value="${app.attr(cfg.characterTarget || '')}" placeholder="可空，如：林恒 / 云瑶 / 环境 / 所有人物" /></div>
                <div class="field"><label>关键词</label><input class="input" id="cmKeyword" value="${app.attr(cfg.keyword || '')}" placeholder="完全自由输入，如：嚣张语气对话 / 吃醋嘴硬 / 打斗动作 / 景色氛围" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>单章</label><input class="input" id="cmChapter" type="number" min="1" value="${app.attr(cfg.chapter || '')}" placeholder="可空" /></div>
                <div class="field"><label>并发数</label><input class="input" id="cmWorkers" type="number" min="1" max="16" value="${app.attr(cfg.maxWorkers || 4)}" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>起始章</label><input class="input" id="cmStart" type="number" min="1" value="${app.attr(cfg.start || '')}" placeholder="可空" /></div>
                <div class="field"><label>结束章</label><input class="input" id="cmEnd" type="number" min="1" value="${app.attr(cfg.end || '')}" placeholder="可空" /></div>
              </div>
              <div class="option-grid two-col">
                <label><input type="checkbox" id="cmAll" ${cfg.allChapters !== false ? 'checked' : ''}/> 全部章节</label>
                <label><input type="checkbox" id="cmConcurrent" ${cfg.concurrent !== false ? 'checked' : ''}/> 并发抽取</label>
                <label><input type="checkbox" checked disabled/> 按每章抽取</label>
                <label><input type="checkbox" checked disabled/> JSONL 输出</label>
              </div>
              <div class="action-row two-actions compact-actions">
                <button class="big-action primary-action" id="cmRun" type="button"><span>◆</span><div><b>开始抽取</b></div></button>
                <button class="big-action primary-action" id="cmStop" type="button"><span>×</span><div><b>停止抽取</b></div></button>
              </div>
            </div>
          </div>
        </div>
        ${app.renderTerminalPanel('character_material')}
      </div>
    </section>
  `;
};


// --- assets/pages/current_plot.js ---
window.renderCurrentPlotPage = function renderCurrentPlotPage(app) {
  const cfg = app.state.config.current_plot || {};
  const platforms = app.state.currentPlotPlatforms || app.state.characterMaterialPlatforms || {};
  const defaults = (app.state.currentPlotDefaults || app.state.characterMaterialDefaults || {})[cfg.platform || 'deepseek'] || {};
  const platformOptions = Object.entries(platforms).map(([key, label]) => `<option value="${app.attr(key)}" ${String(cfg.platform || 'deepseek') === key ? 'selected' : ''}>${app.escape(label)}</option>`).join('');
  const baseUrl = cfg.baseUrl || defaults.baseUrl || '';
  const modelName = cfg.modelName || defaults.modelName || '';
  const mode = cfg.mode || 'extract_merge';
  const modeChecked = (value) => String(mode) === value ? 'checked' : '';
  return `
    <section class="page active" data-page="current_plot">
      <div class="fanqie-task-grid current-plot-layout">
        <div class="fanqie-settings-card current-plot-card">
          <div class="settings-body">
            <div class="form-grid current-plot-form">
              <div class="field">
                <label>小说</label>
                ${app.filePicker('cpSource', cfg.source || '', 'cpChooseSource', '选择完整小说')}
              </div>
              <div class="field">
                <label>已有当前剧情</label>
                ${app.filePicker('cpCurrentPlotFile', cfg.currentPlotFile || '', 'cpChooseCurrentPlotFile', '选择已有当前剧情')}
              </div>
              <div class="field">
                <label>输出目录</label>
                ${app.filePicker('cpOutputDir', cfg.outputDir || '', 'cpChooseOutputDir', '自动生成 / 选择目录')}
              </div>
              <div class="field">
                <label>输出文件</label>
                ${app.filePicker('cpOutputFile', cfg.outputFile || '', 'cpChooseOutputFile', '自动命名 / 选择输出文件')}
              </div>

              <div class="field"><label>模型配置</label><select class="select" id="cpPlatform">${platformOptions}</select></div>
              <div class="field"><label>API Key</label><input class="input" id="cpApiKey" type="password" value="${app.attr(cfg.apiKey || '')}" placeholder="可留空，读取环境变量" /></div>
              <div class="field"><label>Base URL</label><input class="input" id="cpBaseUrl" value="${app.attr(baseUrl)}" placeholder="OpenAI 兼容接口地址" /></div>
              <div class="field-pair">
                <div class="field"><label>模型名称</label><input class="input" id="cpModelName" value="${app.attr(modelName)}" placeholder="deepseek-v4-flash / gpt-4o-mini" /></div>
                <div class="field"><label>温度</label><input class="input" id="cpTemperature" type="number" min="0" max="2" step="0.1" value="${app.attr(cfg.temperature ?? 0.2)}" /></div>
              </div>

              <input type="hidden" id="cpScope" value="${app.attr(cfg.scope || 'range')}" />
              <div class="field-pair">
                <div class="field"><label>单章</label><input class="input" id="cpChapter" type="number" min="1" value="${app.attr(cfg.chapter || '')}" placeholder="章节号" /></div>
                <div class="field"><label>前后章</label><input class="input" id="cpAroundChapter" type="number" min="1" value="${app.attr(cfg.aroundChapter || '')}" placeholder="当前章" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>范围开始</label><input class="input" id="cpStart" type="number" min="1" value="${app.attr(cfg.start || '')}" placeholder="起始章" /></div>
                <div class="field"><label>范围结束</label><input class="input" id="cpEnd" type="number" min="1" value="${app.attr(cfg.end || '')}" placeholder="留空到最后" /></div>
              </div>

              <div class="cp-mode-grid">
                <label class="cp-mode-card"><input type="radio" name="cpMode" value="serial" ${modeChecked('serial')} /><span>逐章精修</span></label>
                <label class="cp-mode-card"><input type="radio" name="cpMode" value="extract_merge" ${modeChecked('extract_merge')} /><span>并发合并</span></label>
                <label class="cp-mode-card"><input type="radio" name="cpMode" value="fast_preview" ${modeChecked('fast_preview')} /><span>快速预览</span></label>
              </div>

              <div class="field-pair">
                <div class="field"><label>摘要目标字数</label><input class="input" id="cpTargetWords" type="number" min="80" max="500" value="${app.attr(cfg.targetWords || 260)}" /></div>
                <div class="field"><label>参考章节数</label><input class="input" id="cpRecentContext" type="number" min="0" max="20" value="${app.attr(cfg.recentContextCount ?? 5)}" /></div>
              </div>
              <div class="field"><label>并发数</label><input class="input" id="cpWorkers" type="number" min="1" max="16" value="${app.attr(cfg.maxWorkers || 4)}" /></div>
              <label class="cp-check-card"><input type="checkbox" id="cpReplaceExisting" ${cfg.replaceExisting !== false ? 'checked' : ''}/><span>覆盖已有章节摘要</span></label>

              <div class="action-row two-actions compact-actions cp-actions-grid">
                <button class="big-action" data-cp-scope="single" type="button"><span>1</span><div><b>总结单章</b></div></button>
                <button class="big-action" data-cp-scope="around" type="button"><span>±</span><div><b>总结前后</b></div></button>
                <button class="big-action" data-cp-scope="range" type="button"><span>↔</span><div><b>总结范围</b></div></button>
                <button class="big-action primary-action" id="cpStop" type="button"><span>×</span><div><b>停止总结</b></div></button>
              </div>
            </div>
          </div>
        </div>
        ${app.renderTerminalPanel('current_plot')}
      </div>
    </section>
  `;
};


// --- assets/pages/webnovel_writer.js ---
window.renderWebnovelWriterPage = function renderWebnovelWriterPage(app) {
  const cfg = app.state.config.webnovel_writer || {};
  const platforms = app.state.webnovelWriterPlatforms || app.state.characterMaterialPlatforms || {};
  const defaults = (app.state.webnovelWriterDefaults || {})[cfg.platform || 'deepseek'] || {};
  const platformOptions = Object.entries(platforms).map(([key, label]) => `<option value="${app.attr(key)}" ${String(cfg.platform || 'deepseek') === key ? 'selected' : ''}>${app.escape(label)}</option>`).join('');
  const baseUrl = cfg.baseUrl || defaults.baseUrl || 'https://api.deepseek.com/v1';
  const modelName = cfg.modelName || defaults.modelName || 'deepseek-chat';
  const strictness = cfg.strictness || '标准门禁';
  return `
    <section class="page active" data-page="webnovel_writer">
      <div class="fanqie-task-grid current-plot-layout webnovel-writer-layout">
        <div class="fanqie-settings-card webnovel-writer-card">
          <div class="settings-body">
            <div class="form-grid current-plot-form ww-form">
              <input type="hidden" id="wwProjectId" value="${app.attr(cfg.projectId || cfg.projectPath || '')}" />

              <div class="field">
                <label>小说项目目录</label>
                ${app.filePicker('wwProjectPath', cfg.projectPath || '', 'wwChooseProjectPath', '选择 / 新建项目目录')}
              </div>

              <div class="field">
                <label>小说 TXT 文件</label>
                ${app.filePicker('wwNovelFilePath', cfg.novelFilePath || '', 'wwChooseNovelFilePath', '选择 / 新建小说 TXT')}
              </div>

              <div class="field">
                <label>设定文件</label>
                ${app.filePicker('wwStoryConfigPath', cfg.storyConfigPath || '', 'wwChooseStoryConfigPath', '选择设定 Markdown / JSON')}
              </div>

              <div class="field"><label>模型平台</label><select class="select" id="wwPlatform">${platformOptions}</select></div>
              <div class="field"><label>API Key</label><input class="input" id="wwApiKey" type="password" value="${app.attr(cfg.apiKey || '')}" placeholder="可留空，读取环境变量" /></div>
              <div class="field"><label>Base URL</label><input class="input" id="wwBaseUrl" value="${app.attr(baseUrl)}" placeholder="OpenAI 兼容接口地址" /></div>
              <div class="field-pair">
                <div class="field"><label>模型名称</label><input class="input" id="wwModelName" value="${app.attr(modelName)}" placeholder="deepseek-chat" /></div>
                <div class="field"><label>温度</label><input class="input" id="wwTemperature" type="number" min="0" max="2" step="0.05" value="${app.attr(cfg.temperature ?? defaults.temperature ?? 0.72)}" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>Max Tokens</label><input class="input" id="wwMaxTokens" type="number" min="1024" max="64000" step="512" value="${app.attr(cfg.maxTokens || defaults.maxTokens || 8192)}" /></div>
                <div class="field"><label>最近上下文</label><input class="input" id="wwRecentContext" type="number" min="0" max="30" value="${app.attr(cfg.recentContextCount ?? 6)}" /></div>
              </div>

              <div class="field-pair">
                <div class="field"><label>章节号</label><input class="input" id="wwChapterNo" type="number" min="1" value="${app.attr(cfg.chapterNo || 1)}" /></div>
                <div class="field"><label>章节标题</label><input class="input" id="wwChapterTitle" value="${app.attr(cfg.chapterTitle || '')}" placeholder="留空自动识别" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>批量开始</label><input class="input" id="wwStart" type="number" min="1" value="${app.attr(cfg.start || 1)}" /></div>
                <div class="field"><label>批量结束</label><input class="input" id="wwEnd" type="number" min="1" value="${app.attr(cfg.end || 1)}" /></div>
              </div>
              <div class="field-pair">
                <div class="field"><label>目标字数</label><input class="input" id="wwTargetWords" type="number" min="800" max="10000" step="100" value="${app.attr(cfg.targetWords || 2200)}" /></div>
                <div class="field"><label>门禁强度</label><select class="select" id="wwStrictness">
                  <option value="轻量门禁" ${strictness === '轻量门禁' ? 'selected' : ''}>轻量门禁</option>
                  <option value="标准门禁" ${strictness === '标准门禁' ? 'selected' : ''}>标准门禁</option>
                  <option value="严格门禁" ${strictness === '严格门禁' ? 'selected' : ''}>严格门禁</option>
                </select></div>
              </div>

              <label class="cp-check-card ww-check"><input type="checkbox" id="wwAutoFix" ${cfg.autoFix !== false ? 'checked' : ''}/><span>自动修复一轮</span></label>

              <div class="action-row two-actions compact-actions ww-actions-grid">
                <button class="big-action" id="wwPlanFull" type="button"><span>总</span><div><b>全书大纲</b></div></button>
                <button class="big-action" id="wwPlanVolume" type="button"><span>卷</span><div><b>分卷大纲</b></div></button>
                <button class="big-action" id="wwPlanBlueprint" type="button"><span>章</span><div><b>章节蓝图</b></div></button>
                <button class="big-action" id="wwWriteChapter" type="button"><span>写</span><div><b>写单章</b></div></button>
                <button class="big-action" id="wwBatchWrite" type="button"><span>批</span><div><b>批量写章</b></div></button>
                <button class="big-action" id="wwReview" type="button"><span>审</span><div><b>审查</b></div></button>
                <button class="big-action" id="wwValidate" type="button"><span>验</span><div><b>全书校验</b></div></button>
                <button class="big-action" id="wwStop" type="button"><span>×</span><div><b>停止</b></div></button>
              </div>
            </div>
          </div>
        </div>
        ${app.renderTerminalPanel('webnovel_writer')}
      </div>
    </section>
  `;
};


// --- assets/app.js ---
(function () {
  const { pageTitles, defaultPage } = window.NovelConstants;

  const app = {
    state: { config: {}, paths: {}, platforms: {}, adProfiles: [] },
    currentPage: defaultPage,
    hasUserSelectedPage: false,
    api: null,
    logs: {
      process_novel: [],
      process_novel_batch: [],
      clean_text_ads: [],
      clean_text_breaks: [],
      novel_splitter: [],
      auto_publish: [],
      chapter_sync: [],
      web_crawler: [],
      character_material: [],
      current_plot: [],
      webnovel_writer: [],
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
    statusOnlyPages: ['auto_publish', 'chapter_sync', 'web_crawler', 'webnovel_writer'],
    loglessPages: ['auto_publish', 'chapter_sync', 'novel_splitter', 'process_novel_batch', 'clean_text_ads', 'clean_text_breaks', 'character_material', 'current_plot', 'webnovel_writer'],

    isStatusOnlyPage(page) { const targetPage = this.logAliases[page] || page; return this.statusOnlyPages.includes(targetPage); },
    isLoglessPage(page) { const targetPage = this.logAliases[page] || page; return this.loglessPages.includes(targetPage); },
    isChapterExtractMode(mode) {
      return ['single', 'around', 'range'].includes(String(mode || ''));
    },
    taskLabel(mode) {
      return {
        single: '提取单章',
        around: '提取前后章',
        range: '提取范围',
        organizeSingle: '整理单章',
        organizeAround: '整理前后章',
        organizeRange: '整理范围',
        formatNovel: '格式化整本',
        formatFolder: '批量格式化',
      }[mode] || '任务';
    },
    setHeaderStatus(message, level = 'ready') {
      const badge = document.getElementById('statusBadge');
      if (!badge) return;
      const text = String(message || '就绪').trim() || '就绪';
      badge.className = `status-badge ${level === 'busy' ? 'busy' : level === 'error' ? 'error' : ''}`.trim();
      badge.innerHTML = `<i></i> ${this.escape(text)}`;
    },
    ...window.NovelUiMethods,
    ...window.NovelTaskPanelMethods,
    ...window.NovelCrawlerOutputMethods,
    ...window.NovelSplitterMethods,
    ...window.NovelCharacterMaterialMethods,
    ...window.NovelCurrentPlotMethods,
    ...window.NovelWebnovelWriterMethods,
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
        if (page === 'process_novel') {
          this.state.config.process_novel = Object.assign({}, this.state.config.process_novel || {}, this.collectProcessConfig());
          this.state.config.clean_text = Object.assign({}, this.state.config.clean_text || {}, this.collectCleanTextConfig());
          this.state.config.novel_splitter = Object.assign({}, this.state.config.novel_splitter || {}, this.collectNovelSplitConfig());
        } else if (page === 'auto_publish') {
          this.state.config.auto_publish = this.collectPublishPayload('ap', this.state.config.auto_publish?.operation || 'publish');
        } else if (page === 'chapter_sync') {
          this.state.config.chapter_sync = this.collectPublishPayload('sy', this.state.config.chapter_sync?.operation || 'publish');
        } else if (page === 'web_crawler') {
          this.state.config.web_crawler = this.collectCrawlerConfig();
        } else if (page === 'character_material') {
          this.state.config.character_material = this.collectCharacterMaterialConfig();
        } else if (page === 'current_plot') {
          this.state.config.current_plot = this.collectCurrentPlotConfig();
        } else if (page === 'webnovel_writer') {
          this.state.config.webnovel_writer = this.collectWebnovelWriterConfig();
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
            process_novel: [],
            process_novel_batch: [],
            clean_text_ads: [],
            clean_text_breaks: [],
            novel_splitter: [],
            auto_publish: [],
            chapter_sync: [],
            web_crawler: [],
            character_material: [],
            current_plot: [],
            webnovel_writer: [],
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
        process_novel: window.renderNovelProcessorPage,
        auto_publish: window.renderFanqiePublisherPage,
        chapter_sync: window.renderFanqieSyncerPage,
        web_crawler: window.renderNovelCrawlerPage,
        character_material: window.renderCharacterMaterialPage,
        current_plot: window.renderCurrentPlotPage,
        webnovel_writer: window.renderWebnovelWriterPage,
      }[this.currentPage] || window.renderNovelProcessorPage;
      document.getElementById('pageHost').innerHTML = renderer(this);
      this.bindPage(this.currentPage);
      this.restorePageLogs();
    },
    restorePageLogs() {
      if (this.currentPage === 'process_novel') {
        ['process_novel', 'novel_splitter', 'process_novel_batch', 'clean_text_ads', 'clean_text_breaks'].forEach((page) => this.restoreLog(page));
      } else {
        this.restoreLog(this.currentPage);
      }
    },
    bindPage(page) {
      if (page === 'process_novel') this.bindProcessNovelPage();
      if (page === 'auto_publish') this.bindAutoPublishPage();
      if (page === 'chapter_sync') this.bindChapterSyncPage();
      if (page === 'web_crawler') this.bindWebCrawlerPage();
      if (page === 'character_material') this.bindCharacterMaterialPage();
      if (page === 'current_plot') this.bindCurrentPlotPage();
      if (page === 'webnovel_writer') this.bindWebnovelWriterPage();
      this.bindFormAutosave(page);
    },

    bindProcessNovelPage() {
      this.bindChooseFile('exChooseNovel', 'process_novel.novelFile', 'exNovelFile', '选择完整小说 TXT', async (path) => {
        this.updateFilePicker('tcAdInput', path, '选择 TXT');
        this.updateFilePicker('tcMoveInput', path, '选择 TXT');
        await this.api.process_novel_analyze(path);
      });
      this.bindChooseFolder('exChooseBatchFolder', 'process_novel.batchFolder', 'exBatchFolder', '选择文件夹', (path) => {
        this.updateFilePicker('tcAdFolder', path, '选择文件夹');
        this.updateFilePicker('tcMoveFolder', path, '选择文件夹');
      });
      this.bindChooseFile('exChooseOutputFile', 'process_novel.outputFile', 'exOutputFile', '自动命名 / 选择输出 TXT', null, true);
      document.querySelectorAll('[data-ex-mode]').forEach((button) => button.addEventListener('click', () => this.runProcessNovel(button.dataset.exMode, button.dataset.exLog || 'process_novel')));
      this.bindChooseFile('tcChooseAdInput', 'clean_text.adInputFile', 'tcAdInput', '选择 TXT');
      this.bindChooseFolder('tcChooseAdFolder', 'clean_text.adBatchFolder', 'tcAdFolder', '选择文件夹');
      this.bindChooseFile('tcChooseMoveInput', 'clean_text.moveInputFile', 'tcMoveInput', '选择 TXT');
      this.bindChooseFolder('tcChooseMoveFolder', 'clean_text.moveBatchFolder', 'tcMoveFolder', '选择文件夹');
      document.getElementById('tcAdRun')?.addEventListener('click', () => this.runCleanText('ad'));
      document.getElementById('tcMoveRun')?.addEventListener('click', () => this.runCleanText('move'));
      this.bindNovelSplitterControls();
    },
    collectProcessConfig() {
      return {
        novelFile: document.getElementById('exNovelFile')?.value || '',
        batchFolder: document.getElementById('exBatchFolder')?.value || '',
        outputFile: document.getElementById('exOutputFile')?.value || '',
        chapter: Number(document.getElementById('exChapter')?.value || 0),
        aroundChapter: Number(document.getElementById('exAroundChapter')?.value || 0),
        start: Number(document.getElementById('exStart')?.value || 0),
        end: Number(document.getElementById('exEnd')?.value || 0),
      };
    },
    collectCleanTextConfig() {
      return {
        adInputFile: document.getElementById('tcAdInput')?.value || '',
        adBatchFolder: document.getElementById('tcAdFolder')?.value || '',
        moveInputFile: document.getElementById('tcMoveInput')?.value || '',
        moveBatchFolder: document.getElementById('tcMoveFolder')?.value || '',
        adProfile: document.getElementById('tcAdProfile')?.value || 'default',
        overwrite: !!document.getElementById('tcAdOverwrite')?.checked,
        backup: !!document.getElementById('tcAdBackup')?.checked,
        normalizePunctuation: document.getElementById('tcMovePunctuation')?.value !== 'off',
        maxMoveChars: Number(document.getElementById('tcMaxMoveChars')?.value || 120),
      };
    },
    async runProcessNovel(mode, logTarget) {
      const payload = Object.assign({}, this.collectProcessConfig(), { mode, logTarget });
      const targetPage = this.logAliases[logTarget] || logTarget || 'process_novel';
      this.activeResultModes[targetPage] = this.isChapterExtractMode(mode) ? 'chapter_text' : '';
      this.resultTexts[targetPage] = '';
      this.state.config.process_novel = payload;
      await this.saveConfig();
      this.beginTaskUi(logTarget, `${this.taskLabel(mode)}中...`);
      const ok = await this.api.process_novel_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', logTarget);
    },
    async runCleanText(scope) {
      const isMove = scope === 'move';
      const logTarget = isMove ? 'clean_text_breaks' : 'clean_text_ads';
      const saved = this.collectCleanTextConfig();
      const payload = Object.assign({}, saved, {
        scope,
        inputFile: document.getElementById(isMove ? 'tcMoveInput' : 'tcAdInput')?.value || '',
        batchFolder: document.getElementById(isMove ? 'tcMoveFolder' : 'tcAdFolder')?.value || '',
        overwrite: !!document.getElementById(isMove ? 'tcMoveOverwrite' : 'tcAdOverwrite')?.checked,
        backup: !!document.getElementById(isMove ? 'tcMoveBackup' : 'tcAdBackup')?.checked,
      });
      this.state.config.clean_text = Object.assign({}, this.state.config.clean_text || {}, saved, payload);
      await this.saveConfig();
      this.beginTaskUi(logTarget, isMove ? '修复断行中...' : '清理广告中...');
      const ok = await this.api.clean_text_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', logTarget);
    },

    async stopTask(apiName, page) {
      if (!this.api[apiName]) return this.toast('当前版本不支持停止任务。', 'warning', page);
      const ok = await this.api[apiName]();
      if (!ok) this.toast('当前没有正在运行的任务。', 'warning', page);
    },

    bindWebCrawlerPage() {
      this.bindCrawlerOutputControls();
      document.getElementById('nsRun')?.addEventListener('click', () => this.runWebCrawler());
      document.getElementById('nsStop')?.addEventListener('click', () => this.stopTask('web_crawler_stop', 'web_crawler'));
    },
    collectCrawlerConfig() {
      return {
        novelUrl: document.getElementById('nsUrl')?.value || '',
        outputFile: document.getElementById('nsOutput')?.value || '',
        outputFileManual: !!(this.state.config.web_crawler || {}).outputFileManual,
        outputAutoUrl: (this.state.config.web_crawler || {}).outputAutoUrl || '',
        start: Number(document.getElementById('nsStart')?.value || 1),
        end: Number(document.getElementById('nsEnd')?.value || 0),
        maxWorkers: Number(document.getElementById('nsWorkers')?.value || 16),
        timeout: Number(document.getElementById('nsTimeout')?.value || 25),
        requestDelayMin: Number(document.getElementById('nsDelayMin')?.value || 0.12),
        requestDelayMax: Number(document.getElementById('nsDelayMax')?.value || 0.35),
        maxRetries: Number(document.getElementById('nsRetries')?.value || 3),
        htmlFallback: !!document.getElementById('nsHtmlFallback')?.checked,
        detailedLog: !!document.getElementById('nsDetailedLog')?.checked,
      };
    },
    async runWebCrawler() {
      const cfg = this.state.config.web_crawler || {};
      if (!cfg.outputFileManual && !(document.getElementById('nsOutput')?.value || '').trim()) {
        await this.refreshCrawlerAutoOutput(true);
      }
      const payload = this.collectCrawlerConfig();
      this.state.config.web_crawler = payload;
      await this.saveConfig();
      this.beginTaskUi('web_crawler', '准备启动网页抓取...');
      const ok = await this.api.web_crawler_run(payload);
      if (!ok) this.toast('任务没有启动，请查看日志。', 'warning', 'web_crawler');
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

