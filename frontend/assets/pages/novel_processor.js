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
