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
