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
