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
