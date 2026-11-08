document.addEventListener('DOMContentLoaded', async () => {
  console.log('Trading App: загрузка...');
  
  let trades = [], plans = [], diaryEntries = [];
  let editingTradeId = null, editingPlanId = null, editingDiaryId = null;
  let initialDeposit = 0, availableTokens = [], availableTags = [];
  let currentView = 'journal';
  let currentPeriod = localStorage.getItem('trading_period') || 'all';
  let currentTagFilter = localStorage.getItem('trading_tag_filter') || 'all';
  let currentPlanFilter = localStorage.getItem('trading_plan_filter') || 'pending';
  let selectedTags = [], planChecklist = [];

  const defaultTags = ['скальпинг', 'свинг', 'аирдроп', 'по сигналу', 'FOMO', 'тест'];
  const defaultChecklist = ['Тренд подтверждён', 'Объём растёт', 'Уровень С/П', 'Нет новостей 2ч'];
  const emotions = [
    { value: 1, emoji: '😫', label: 'Ужасно' }, { value: 2, emoji: '😟', label: 'Плохо' },
    { value: 3, emoji: '😕', label: 'Тревожно' }, { value: 4, emoji: '😐', label: 'Так себе' },
    { value: 5, emoji: '😶', label: 'Нормально' }, { value: 6, emoji: '🙂', label: 'Хорошо' },
    { value: 7, emoji: '😊', label: 'Уверенно' }, { value: 8, emoji: '😎', label: 'Отлично' },
    { value: 9, emoji: '🤩', label: 'Супер' }, { value: 10, emoji: '🚀', label: 'Максимум!' }
  ];

  function renderAuthBadge() {
    const isAuth = typeof FirebaseClient !== 'undefined' && FirebaseClient.isAuthenticated();
    const email = isAuth ? FirebaseClient.getCurrentUser()?.email : 'Гостевой режим';
    const color = isAuth ? '#00ff9d' : '#ffe600';
    const icon = isAuth ? '🟢' : '🟡';
    const statusText = isAuth ? 'Синхронизация ВКЛ' : 'Гость (без синхронизации)';
    
    let badge = document.getElementById('auth-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'auth-status-badge';
      badge.style.cssText = 'position:fixed;top:70px;right:10px;background:rgba(10,10,18,0.95);border:1px solid '+color+';color:'+color+';padding:8px 12px;border-radius:8px;font-size:0.8rem;z-index:9999;display:flex;flex-direction:column;gap:4px;backdrop-filter:blur(4px);box-shadow:0 4px 12px rgba(0,0,0,0.5);max-width:280px;';
      document.body.appendChild(badge);
    }
    badge.innerHTML = '<div style="display:flex;align-items:center;gap:6px;font-weight:600;">'+icon+' '+statusText+'</div><div style="color:#a0a0b0;font-size:0.7rem;word-break:break-all;">'+email+'</div>';
    badge.style.borderColor = color;
    badge.querySelector('div:first-child').style.color = color;
  }

  try {
    const isGuest = localStorage.getItem('guest_mode') === 'true';
    
    if (typeof FirebaseClient !== 'undefined') {
      await FirebaseClient.init();
      await new Promise(resolve => FirebaseClient.onAuthReady(() => resolve()));
      
      if (!FirebaseClient.isAuthenticated() && !isGuest) {
        window.location.href = 'auth.html';
        return;
      }
      
      if (FirebaseClient.isAuthenticated()) {
        console.log('🔄 Миграция токенов...');
        await FirebaseClient.migrateTokensFromLocalStorage();
      }
    }
    
    await TradingDB.init();
    trades = await TradingDB.getAll();
    plans = await TradingDB.getAllPlans();
    diaryEntries = await TradingDB.getAllDiary();
    initialDeposit = await TradingDB.getSetting('initialDeposit');
    availableTags = await TradingDB.getSetting('availableTags');
    if (!availableTags || !Array.isArray(availableTags)) {
      availableTags = [...defaultTags];
      await TradingDB.saveSetting('availableTags', availableTags);
    }
    await loadTokens();
    
    if (typeof Notifications !== 'undefined') {
      await Notifications.loadAlerts();
      Notifications.startPeriodicCheck();
    }
    
    handleNavigation();
    window.addEventListener('hashchange', handleNavigation);
    renderAuthBadge();
    console.log('Приложение готово');
  } catch (err) {
    console.error('Ошибка:', err);
    document.getElementById('main-content').innerHTML = '<div style="padding: 2rem; text-align: center;"><h2 style="color: var(--neon-red);">Ошибка</h2><p>'+err.message+'</p></div>';
  }

  document.getElementById('close-modal').addEventListener('click', () => document.getElementById('trade-modal').close());
  document.getElementById('trade-form').addEventListener('submit', async (e) => { e.preventDefault(); await handleFormSubmit(); });

  document.getElementById('main-content').addEventListener('click', async (e) => {
    const t = e.target;
    if (t.id === 'add-trade-btn') { openTradeModal(); return; }
    if (t.id === 'add-plan-btn') { openPlanModal(); return; }
    if (t.id === 'add-diary-btn') { openDiaryModal(); return; }
    if (t.classList.contains('edit-trade')) { openTradeModal(t.dataset.id); return; }
    if (t.classList.contains('edit-plan')) { openPlanModal(t.dataset.id); return; }
    if (t.classList.contains('edit-diary')) { openDiaryModal(t.dataset.id); return; }
    
    if (t.classList.contains('delete-trade')) {
      if (confirm('Удалить сделку?')) { await TradingDB.delete(t.dataset.id); trades = await TradingDB.getAll(); TradingStats.clearCache(); handleNavigation(); }
      return;
    }
    if (t.classList.contains('delete-plan')) {
      if (confirm('Удалить план?')) { await TradingDB.deletePlan(t.dataset.id); plans = await TradingDB.getAllPlans(); handleNavigation(); }
      return;
    }
    if (t.classList.contains('delete-diary')) {
      if (confirm('Удалить запись?')) { await TradingDB.deleteDiary(t.dataset.id); diaryEntries = await TradingDB.getAllDiary(); handleNavigation(); }
      return;
    }
    if (t.classList.contains('complete-plan')) { openPlanModal(t.dataset.id, true); return; }
    if (t.classList.contains('period-btn') && !t.classList.contains('plan-filter-btn')) {
      const p = t.dataset.period;
      if (p && p !== currentPeriod) { currentPeriod = p; localStorage.setItem('trading_period', p); TradingStats.clearCache(); handleNavigation(); }
      return;
    }
    if (t.classList.contains('tag-filter-btn')) {
      const tag = t.dataset.tag;
      if (tag) { currentTagFilter = tag; localStorage.setItem('trading_tag_filter', tag); TradingStats.clearCache(); handleNavigation(); }
      return;
    }
    if (t.classList.contains('plan-filter-btn')) {
      const f = t.dataset.filter;
      if (f && f !== currentPlanFilter) { currentPlanFilter = f; localStorage.setItem('trading_plan_filter', f); handleNavigation(); }
      return;
    }
    if (t.id === 'save-deposit-btn') {
      const v = parseFloat(document.getElementById('settings-deposit').value) || 0;
      await TradingDB.saveSetting('initialDeposit', v); initialDeposit = v; TradingStats.clearCache(); alert('Сохранено: $' + v.toFixed(2)); return;
    }
    if (t.id === 'export-btn') { exportData(); return; }
    if (t.id === 'import-btn') { document.getElementById('import-file').click(); return; }
    if (t.id === 'clear-all-btn') {
      if (confirm('Удалить ВСЕ данные?') && confirm('Точно?')) {
        for (const tr of trades) await TradingDB.delete(tr.id);
        for (const pl of plans) await TradingDB.deletePlan(pl.id);
        for (const d of diaryEntries) await TradingDB.deleteDiary(d.id);
        trades = []; plans = []; diaryEntries = []; TradingStats.clearCache(); handleNavigation();
      }
      return;
    }
    if (t.classList.contains('remove-tag-btn')) { selectedTags = selectedTags.filter(x => x !== t.dataset.tag); renderSelectedTags(); return; }
    if (t.classList.contains('tag-suggestion-item') && t.dataset.tag) {
      if (!selectedTags.includes(t.dataset.tag)) selectedTags.push(t.dataset.tag);
      renderSelectedTags();
      document.getElementById('trade-tags-input').value = '';
      document.getElementById('tag-suggestions').style.display = 'none';
      return;
    }
    if (t.id === 'add-custom-tag-btn') {
      const v = document.getElementById('trade-tags-input').value.trim().toLowerCase();
      if (v && !availableTags.includes(v)) { availableTags.push(v); await TradingDB.saveSetting('availableTags', availableTags); }
      if (v && !selectedTags.includes(v)) selectedTags.push(v);
      renderSelectedTags();
      document.getElementById('trade-tags-input').value = '';
      document.getElementById('tag-suggestions').style.display = 'none';
      return;
    }
    if (t.classList.contains('delete-tag-btn')) {
      const tag = t.dataset.tag;
      if (confirm('Удалить тег "'+tag+'"?')) {
        availableTags = availableTags.filter(x => x !== tag);
        await TradingDB.saveSetting('availableTags', availableTags);
        for (const tr of trades) { if (tr.tags && tr.tags.includes(tag)) { tr.tags = tr.tags.filter(x => x !== tag); await TradingDB.update(tr); } }
        trades = await TradingDB.getAll(); renderSettings();
      }
      return;
    }
    if (t.id === 'add-new-tag-btn') {
      const v = document.getElementById('new-tag-input').value.trim().toLowerCase();
      if (v && !availableTags.includes(v)) { availableTags.push(v); await TradingDB.saveSetting('availableTags', availableTags); document.getElementById('new-tag-input').value = ''; renderSettings(); }
      return;
    }
    if (t.classList.contains('emotion-btn')) {
      document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
      t.classList.add('active');
      return;
    }
    if (t.id === 'logout-btn') {
      if (typeof FirebaseClient !== 'undefined' && FirebaseClient.isAuthenticated()) {
        await FirebaseClient.signOut();
        localStorage.removeItem('guest_mode');
        window.location.href = 'auth.html';
      } else {
        localStorage.removeItem('guest_mode');
        window.location.href = 'auth.html';
      }
      return;
    }
  });

  document.getElementById('main-content').addEventListener('input', (e) => {
    if (e.target.id === 'trade-tags-input') showTagSuggestions(e.target.value);
  });

  function getPeriodCutoff(p) {
    const now = new Date(), c = new Date();
    if (p === 'week') c.setDate(now.getDate() - 7);
    else if (p === 'month') c.setMonth(now.getMonth() - 1);
    else if (p === 'year') c.setFullYear(now.getFullYear() - 1);
    else return null;
    return c;
  }
  
  function filterTrades(list, period, tag) {
    let f = list;
    const c = getPeriodCutoff(period);
    if (c) f = f.filter(t => new Date(t.date + 'T' + (t.time || '00:00')) >= c);
    if (tag && tag !== 'all') {
      const tagLower = tag.toLowerCase();
      f = f.filter(t => t.tags && t.tags.some(x => x.toLowerCase() === tagLower));
    }
    return f;
  }
  
  function renderPeriodFilter() {
    const periods = [{k:'week',l:'7 дней'},{k:'month',l:'30 дней'},{k:'year',l:'Год'},{k:'all',l:'Всё время'}];
    let html = '<div class="period-filter">';
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      html += '<button class="period-btn '+(currentPeriod===p.k?'active':'')+'" data-period="'+p.k+'">'+p.l+'</button>';
    }
    html += '</div>';
    return html;
  }
  
  function renderTagFilter() {
    const allTags = ['all'].concat(availableTags);
    let html = '<div class="tag-filter"><span style="font-size:0.85rem;color:var(--text-secondary);margin-right:0.5rem;">Теги:</span>';
    for (let i = 0; i < allTags.length; i++) {
      const t = allTags[i];
      const tagLower = t.toLowerCase();
      const filterLower = currentTagFilter.toLowerCase();
      html += '<button class="tag-filter-btn '+(filterLower===tagLower?'active':'')+'" data-tag="'+t+'">'+(t==='all'?'Все':t)+'</button>';
    }
    html += '</div>';
    return html;
  }

  function handleNavigation() {
    const h = window.location.hash.replace('#','') || 'journal';
    currentView = ['journal','plans','diary','stats','calculators','settings'].includes(h) ? h : 'journal';
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + currentView));
    if (currentView === 'journal') renderJournal();
    else if (currentView === 'plans') renderPlans();
    else if (currentView === 'diary') renderDiary();
    else if (currentView === 'stats') renderStats();
    else if (currentView === 'calculators') renderCalculators();
    else if (currentView === 'settings') renderSettings();
    renderAuthBadge();
  }

  async function loadTokens() {
    availableTokens = [];
    if (typeof TokensRegistry !== 'undefined') {
      try { const t = await TokensRegistry.getAll(); availableTokens = t.map(x => x.name.toUpperCase()); } catch(e){}
    }
    for (let i = 0; i < trades.length; i++) {
      const t = trades[i];
      if (t.token && !availableTokens.includes(t.token.toUpperCase())) availableTokens.push(t.token.toUpperCase());
    }
    availableTokens.sort();
    setupAutocomplete();
  }
  
  function setupAutocomplete() {
    const inp = document.getElementById('trade-token');
    if (!inp) return;
    const old = inp.parentElement.querySelector('.autocomplete-list');
    if (old) old.remove();
    const list = document.createElement('div');
    list.className = 'autocomplete-list';
    inp.parentElement.style.position = 'relative';
    inp.parentElement.appendChild(list);
    let tmr;
    inp.addEventListener('input', () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        const v = inp.value.toUpperCase().trim();
        if (v.length < 1) { list.style.display='none'; return; }
        const m = availableTokens.filter(t => t.includes(v)).slice(0,10);
        if (m.length === 0) { list.style.display='none'; return; }
        let inner = '';
        for (let i = 0; i < m.length; i++) {
          inner += '<div class="autocomplete-item" data-value="'+m[i]+'">'+m[i]+'</div>';
        }
        list.innerHTML = inner;
        list.style.display = 'block';
      }, 100);
    });
    inp.addEventListener('focus', () => { if (inp.value.length >= 1) inp.dispatchEvent(new Event('input')); });
    document.addEventListener('click', (e) => { if (!inp.parentElement.contains(e.target)) list.style.display = 'none'; });
    list.addEventListener('click', (e) => { if (e.target.classList.contains('autocomplete-item')) { inp.value = e.target.dataset.value; list.style.display = 'none'; } });
  }

  function showTagSuggestions(v) {
    const el = document.getElementById('tag-suggestions');
    if (!el) return;
    const val = v.toLowerCase().trim();
    if (val.length < 1) { el.style.display = 'none'; return; }
    const m = availableTags.filter(t => t.toLowerCase().includes(val) && !selectedTags.some(s => s.toLowerCase() === t.toLowerCase())).slice(0,5);
    if (m.length === 0) { el.innerHTML = '<div class="tag-suggestion-item" id="add-custom-tag-btn">+ Создать "'+val+'"</div>'; el.style.display = 'block'; return; }
    let inner = '';
    for (let i = 0; i < m.length; i++) {
      inner += '<div class="tag-suggestion-item" data-tag="'+m[i]+'">'+m[i]+'</div>';
    }
    el.innerHTML = inner;
    el.style.display = 'block';
  }
  
  function renderSelectedTags() {
    const c = document.getElementById('selected-tags');
    if (!c) return;
    if (selectedTags.length === 0) { c.innerHTML = ''; return; }
    let html = '';
    for (let i = 0; i < selectedTags.length; i++) {
      const t = selectedTags[i];
      html += '<span class="selected-tag">'+t+'<span class="remove-tag remove-tag-btn" data-tag="'+t+'">&times;</span></span>';
    }
    c.innerHTML = html;
  }
  
  function getTagClass(t) {
    const l = t.toLowerCase();
    if (l.includes('скальп')) return 'tag-scalp';
    if (l.includes('свинг')) return 'tag-swing';
    if (l.includes('аирдроп')) return 'tag-airdrop';
    if (l.includes('сигнал')) return 'tag-signal';
    if (l.includes('fomo')) return 'tag-signal';
    return 'tag-custom';
  }
  
  function renderTags(tags) {
    if (!tags || tags.length === 0) return '';
    let html = '';
    for (let i = 0; i < tags.length; i++) {
      html += '<span class="tag '+getTagClass(tags[i])+'">'+tags[i]+'</span>';
    }
    return html;
  }

  function renderJournal() {
    const f = filterTrades(trades, currentPeriod, currentTagFilter);
    const s = TradingStats.calculate(f, initialDeposit);
    const c = document.createElement('div');
    let html = renderPeriodFilter() + renderTagFilter();
    html += '<section class="stats-grid">';
    html += '<div class="stat-card"><h3>Баланс</h3><div class="stat-value neutral">$'+s.currentBalance.toFixed(2)+'</div></div>';
    html += '<div class="stat-card"><h3>Прибыль</h3><div class="stat-value '+(s.netProfit>=0?'positive':'negative')+'">'+TradingStats.formatMoney(s.netProfit)+'</div></div>';
    html += '<div class="stat-card"><h3>Win Rate</h3><div class="stat-value neutral">'+TradingStats.formatPercent(s.winRate)+'</div></div>';
    html += '<div class="stat-card"><h3>Profit Factor</h3><div class="stat-value neutral">'+s.profitFactor.toFixed(2)+'</div></div>';
    html += '<div class="stat-card"><h3>Сделок</h3><div class="stat-value neutral">'+s.totalTrades+'</div></div>';
    html += '<div class="stat-card"><h3>Приб/Убыт</h3><div class="stat-value"><span style="color:var(--neon-green);">'+s.winningTrades+'</span>/<span style="color:var(--neon-red);">'+s.losingTrades+'</span></div></div>';
    html += '</section>';
    html += '<section class="section">';
    const filterLabel = (currentPeriod!=='all' || currentTagFilter!=='all') ? '<span style="color:var(--text-secondary);font-size:0.9rem;font-weight:400;">(фильтр)</span>' : '';
    html += '<div class="section-header"><h2>Журнал сделок '+filterLabel+'</h2>';
    html += '<button class="btn" id="add-trade-btn">+ Сделка</button></div>';
    if (f.length > 0) {
      html += '<div class="trades-table">' + renderTradesTable(f) + '</div>';
    } else {
      html += '<div class="trades-table"><div class="empty-state">Нет сделок</div></div>';
    }
    html += '</section>';
    c.innerHTML = html;
    const main = document.getElementById('main-content');
    main.innerHTML = ''; main.appendChild(c);
  }
  
  function renderTradesTable(list) {
    const s = [...list].sort((a,b) => new Date(b.date+'T'+b.time)-new Date(a.date+'T'+a.time));
    let h = '<div class="trade-row header"><div>Дата</div><div>Токен</div><div>Вход/Выход</div><div>Кол-во</div><div>Комиссия</div><div>P&L</div><div></div></div>';
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      const pnl = TradingStats.calculatePnL(t);
      const cls = pnl >= 0 ? 'positive' : 'negative';
      const tagsHtml = renderTags(t.tags);
      h += '<div class="trade-row">';
      h += '<div class="trade-date">'+t.date+' '+t.time+'</div>';
      h += '<div><div class="trade-token">'+t.token+'</div>';
      if (tagsHtml) h += '<div style="margin-top:0.3rem;">'+tagsHtml+'</div>';
      h += '</div>';
      h += '<div><div>$'+parseFloat(t.entryPrice).toFixed(6)+'</div><div>$'+parseFloat(t.exitPrice).toFixed(6)+'</div></div>';
      h += '<div>'+parseFloat(t.quantity).toLocaleString()+'</div>';
      h += '<div>$'+parseFloat(t.fee||0).toFixed(2)+'</div>';
      h += '<div class="trade-pnl '+cls+'">'+TradingStats.formatMoney(pnl)+'</div>';
      h += '<div class="trade-actions"><button class="edit-trade" data-id="'+t.id+'">✏️</button><button class="delete-trade" data-id="'+t.id+'">🗑️</button></div>';
      h += '</div>';
    }
    return h;
  }

  function renderPlans() {
    const c = document.createElement('div');
    const filters = [{k:'pending',l:'🟡 Активные'},{k:'completed',l:'🟢 Завершённые'},{k:'cancelled',l:'⚪ Отменённые'},{k:'all',l:'Все'}];
    const f = currentPlanFilter==='all' ? plans : plans.filter(p => p.status===currentPlanFilter);
    const sorted = [...f].sort((a,b) => b.createdAt-a.createdAt);
    const completed = plans.filter(p => p.status==='completed');
    const followed = completed.filter(p => p.followedPlan===true);
    const pwr = completed.length>0 ? (completed.filter(p=>p.actualPnL>0).length/completed.length*100) : 0;
    const pfr = completed.length>0 ? (followed.length/completed.length*100) : 0;
    
    let html = '<section class="section">';
    html += '<div class="section-header"><h2>📋 Планировщик</h2><button class="btn" id="add-plan-btn">+ Новый план</button></div>';
    html += '<div class="stats-grid" style="margin-bottom:1.5rem;">';
    html += '<div class="stat-card"><h3>Активных</h3><div class="stat-value neutral">'+plans.filter(p=>p.status==='pending').length+'</div></div>';
    html += '<div class="stat-card"><h3>Завершено</h3><div class="stat-value positive">'+completed.length+'</div></div>';
    html += '<div class="stat-card"><h3>Win Rate</h3><div class="stat-value neutral">'+pwr.toFixed(0)+'%</div></div>';
    html += '<div class="stat-card"><h3>Соблюдение</h3><div class="stat-value '+(pfr>=70?'positive':'negative')+'">'+pfr.toFixed(0)+'%</div></div>';
    html += '</div>';
    html += '<div class="period-filter">';
    for (let i = 0; i < filters.length; i++) {
      const x = filters[i];
      html += '<button class="period-btn plan-filter-btn '+(currentPlanFilter===x.k?'active':'')+'" data-filter="'+x.k+'">'+x.l+'</button>';
    }
    html += '</div>';
    if (sorted.length > 0) {
      for (let i = 0; i < sorted.length; i++) {
        html += renderPlanCard(sorted[i]);
      }
    } else {
      html += '<div class="empty-state">Нет планов</div>';
    }
    html += '</section>';
    c.innerHTML = html;
    const main = document.getElementById('main-content');
    main.innerHTML = ''; main.appendChild(c);
  }
  
  function renderPlanCard(p) {
    const labels = {pending:'Ожидает',completed:'Завершён',cancelled:'Отменён'};
    const rr = Math.abs(p.plannedEntry-p.plannedSL)>0 ? Math.abs(p.plannedTP-p.plannedEntry)/Math.abs(p.plannedEntry-p.plannedSL) : 0;
    const plannedPnL = (p.plannedTP-p.plannedEntry)*p.positionSize;
    const fLabels = {true:'✅ Да',false:'❌ Нет',partial:'⚠️ Частично'};
    
    let h = '<div class="plan-card plan-'+p.status+'">';
    h += '<div class="plan-header">';
    h += '<div><span class="plan-title">'+p.token+'</span><span style="margin-left:0.5rem;color:var(--text-secondary);font-size:0.85rem;">'+(p.direction==='long'?'📈 Лонг':'📉 Шорт')+'</span></div>';
    h += '<div style="display:flex;gap:0.5rem;align-items:center;">';
    h += '<span class="plan-status '+p.status+'">'+labels[p.status]+'</span>';
    h += '<button class="edit-plan" data-id="'+p.id+'" style="background:var(--bg-input);border:var(--glass-border);border-radius:6px;padding:0.4rem 0.6rem;cursor:pointer;color:var(--text-secondary);">✏️</button>';
    h += '<button class="delete-plan" data-id="'+p.id+'" style="background:var(--bg-input);border:var(--glass-border);border-radius:6px;padding:0.4rem 0.6rem;cursor:pointer;color:var(--text-secondary);">🗑️</button>';
    h += '</div></div>';
    h += '<div class="plan-grid">';
    h += '<div class="plan-item"><div class="plan-item-label">Вход</div><div class="plan-item-value neutral">$'+parseFloat(p.plannedEntry).toFixed(6)+'</div></div>';
    h += '<div class="plan-item"><div class="plan-item-label">Stop Loss</div><div class="plan-item-value negative">$'+parseFloat(p.plannedSL).toFixed(6)+'</div></div>';
    h += '<div class="plan-item"><div class="plan-item-label">Take Profit</div><div class="plan-item-value positive">$'+parseFloat(p.plannedTP).toFixed(6)+'</div></div>';
    h += '<div class="plan-item"><div class="plan-item-label">Размер</div><div class="plan-item-value">'+parseFloat(p.positionSize).toLocaleString()+'</div></div>';
    h += '<div class="plan-item"><div class="plan-item-label">Риск</div><div class="plan-item-value warning">'+p.riskPercent+'%</div></div>';
    h += '<div class="plan-item"><div class="plan-item-label">R:R</div><div class="plan-item-value neutral">1:'+rr.toFixed(2)+'</div></div>';
    h += '</div>';
    if (p.reason) h += '<div style="margin-bottom:0.75rem;"><span style="font-size:0.85rem;color:var(--text-secondary);">Причина:</span> <span style="font-size:0.9rem;">'+p.reason+'</span></div>';
    if (p.checklist && p.checklist.length > 0) {
      h += '<div style="margin-bottom:0.75rem;"><div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;">Чек-лист:</div>';
      for (let i = 0; i < p.checklist.length; i++) {
        const item = p.checklist[i];
        h += '<div class="checklist-item"><input type="checkbox" '+(item.checked?'checked':'')+' disabled><span style="'+(item.checked?'color:var(--neon-green);':'color:var(--text-secondary);')+'">'+item.text+'</span></div>';
      }
      h += '</div>';
    }
    if (p.status==='pending') h += '<button class="btn complete-plan" data-id="'+p.id+'" style="margin-top:0.5rem;">✓ Закрыть план</button>';
    if (p.status==='completed') {
      h += '<div class="plan-comparison">';
      h += '<div class="plan-comparison-col"><h4>📋 План</h4>';
      h += '<div class="plan-item" style="margin-bottom:0.5rem;"><div class="plan-item-label">Вход</div><div class="plan-item-value neutral">$'+parseFloat(p.plannedEntry).toFixed(6)+'</div></div>';
      h += '<div class="plan-item" style="margin-bottom:0.5rem;"><div class="plan-item-label">Выход (TP)</div><div class="plan-item-value positive">$'+parseFloat(p.plannedTP).toFixed(6)+'</div></div>';
      h += '<div class="plan-item"><div class="plan-item-label">Ожидаемая прибыль</div><div class="plan-item-value positive">+$'+plannedPnL.toFixed(2)+'</div></div>';
      h += '</div>';
      h += '<div class="plan-comparison-col"><h4>✅ Факт</h4>';
      const actualPnL = p.actualPnL || 0;
      const pnlClass = actualPnL >= 0 ? 'positive' : 'negative';
      h += '<div class="plan-item" style="margin-bottom:0.5rem;"><div class="plan-item-label">Вход</div><div class="plan-item-value neutral">$'+parseFloat(p.actualEntry||0).toFixed(6)+'</div></div>';
      h += '<div class="plan-item" style="margin-bottom:0.5rem;"><div class="plan-item-label">Выход</div><div class="plan-item-value '+pnlClass+'">$'+parseFloat(p.actualExit||0).toFixed(6)+'</div></div>';
      h += '<div class="plan-item"><div class="plan-item-label">Факт. прибыль</div><div class="plan-item-value '+pnlClass+'">'+(actualPnL>=0?'+':'')+'$'+actualPnL.toFixed(2)+'</div></div>';
      h += '</div></div>';
      if (p.followedPlan) h += '<div style="margin-top:1rem;padding:0.75rem;background:rgba(0,255,157,0.05);border-radius:8px;font-size:0.9rem;">Соблюдение: <strong style="color:var(--neon-green);">'+fLabels[p.followedPlan]+'</strong></div>';
    }
    if (p.notes) h += '<div style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-secondary);"><em>'+p.notes+'</em></div>';
    h += '</div>';
    return h;
  }

  function openPlanModal(id, isComplete) {
    const title = document.getElementById('modal-title');
    editingPlanId = id; editingTradeId = null; editingDiaryId = null;
    planChecklist = defaultChecklist.map(t => ({text:t, checked:false}));
    const cl = document.querySelector('.checklist-container'); if (cl) cl.remove();
    const em = document.querySelector('.emotion-container'); if (em) em.remove();
    
    if (id && !isComplete) {
      const p = plans.find(x => x.id===id);
      title.textContent = 'Редактировать план';
      document.getElementById('trade-date').value = p.plannedDate || '';
      document.getElementById('trade-time').value = p.plannedTime || '';
      document.getElementById('trade-token').value = p.token;
      document.getElementById('trade-entry').value = p.plannedEntry;
      document.getElementById('trade-exit').value = p.plannedTP;
      document.getElementById('trade-sl').value = p.plannedSL || '';
      document.getElementById('trade-quantity').value = p.positionSize;
      document.getElementById('trade-fee').value = p.riskPercent || 2;
      document.getElementById('trade-risk').value = p.riskPercent || 2;
      document.getElementById('trade-notes').value = p.reason || '';
      planChecklist = p.checklist || planChecklist;
      selectedTags = p.tags || [];
      document.getElementById('trade-tags-input').value = selectedTags.join(', ');
    } else if (id && isComplete) {
      const p = plans.find(x => x.id===id);
      title.textContent = 'Закрыть план — введи факты';
      document.getElementById('trade-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('trade-time').value = new Date().toTimeString().slice(0,5);
      document.getElementById('trade-token').value = p.token;
      document.getElementById('trade-entry').value = p.actualEntry || p.plannedEntry;
      document.getElementById('trade-exit').value = p.actualExit || '';
      document.getElementById('trade-sl').value = p.plannedSL || '';
      document.getElementById('trade-quantity').value = p.positionSize;
      document.getElementById('trade-fee').value = p.actualFee || 0;
      document.getElementById('trade-risk').value = p.riskPercent || 2;
      document.getElementById('trade-notes').value = p.notes || '';
      selectedTags = p.tags || [];
      document.getElementById('trade-tags-input').value = selectedTags.join(', ');
    } else {
      title.textContent = 'Новый торговый план';
      document.getElementById('trade-form').reset();
      const now = new Date();
      document.getElementById('trade-date').valueAsDate = now;
      document.getElementById('trade-time').value = now.toTimeString().slice(0,5);
      document.getElementById('trade-risk').value = 2;
      selectedTags = [];
      document.getElementById('trade-tags-input').value = '';
    }
    renderSelectedTags();
    const notesField = document.getElementById('trade-notes');
    let clHtml = '<div class="checklist-container" style="margin-top:0.5rem;"><label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:0.5rem;">Чек-лист:</label>';
    for (let i = 0; i < planChecklist.length; i++) {
      const it = planChecklist[i];
      clHtml += '<div class="checklist-item"><input type="checkbox" class="checklist-item-input" data-idx="'+i+'" '+(it.checked?'checked':'')+'><span>'+it.text+'</span></div>';
    }
    clHtml += '</div>';
    notesField.parentElement.insertAdjacentHTML('afterend', clHtml);
    document.getElementById('trade-modal').showModal();
  }

  async function savePlan(isComplete) {
    const sl = parseFloat(document.getElementById('trade-sl').value) || 0;
    const entry = parseFloat(document.getElementById('trade-entry').value);
    const exit = parseFloat(document.getElementById('trade-exit').value);
    const qty = parseFloat(document.getElementById('trade-quantity').value);
    const fee = parseFloat(document.getElementById('trade-fee').value) || 0;
    const risk = parseFloat(document.getElementById('trade-risk').value) || 2;
    
    const tagsInput = document.getElementById('trade-tags-input').value.trim();
    const parsedTags = tagsInput ? tagsInput.split(/[,;\s]+/).filter(t => t.length > 0).map(t => t.toLowerCase()) : [];
    const allTags = [...new Set([...selectedTags, ...parsedTags])];
    
    const data = {
      id: editingPlanId || crypto.randomUUID(), token: document.getElementById('trade-token').value.toUpperCase(), direction: 'long',
      plannedEntry: entry, plannedTP: exit, plannedSL: sl || entry * 0.95, positionSize: qty, riskPercent: risk,
      reason: document.getElementById('trade-notes').value, checklist: [...planChecklist], notes: '', tags: allTags,
      status: isComplete ? 'completed' : 'pending',
      createdAt: editingPlanId ? (plans.find(p=>p.id===editingPlanId)?.createdAt || Date.now()) : Date.now(),
      completedAt: isComplete ? Date.now() : null, actualEntry: isComplete ? entry : null, actualExit: isComplete ? exit : null,
      actualFee: isComplete ? fee : 0,
      actualPnL: isComplete ? TradingStats.calculatePnL({entryPrice:entry,exitPrice:exit,quantity:qty,fee:fee}) : null,
      followedPlan: isComplete ? (document.querySelector('.plan-followed-btn.active-yes')?true:document.querySelector('.plan-followed-btn.active-no')?false:document.querySelector('.plan-followed-btn.active-partial')?'partial':null) : null
    };
    
    if (editingPlanId) await TradingDB.updatePlan(data); else await TradingDB.addPlan(data);
    document.getElementById('trade-modal').close();
    const cl = document.querySelector('.checklist-container'); if (cl) cl.remove();
    plans = await TradingDB.getAllPlans();
    handleNavigation();
  }

  async function handleFormSubmit() {
    const title = document.getElementById('modal-title').textContent;
    if (title.includes('план') || editingPlanId) { await savePlan(title.includes('Закрыть')); } 
    else if (editingDiaryId || title.includes('дневник')) { await saveDiary(); } 
    else { await saveTrade(); }
  }

  function renderDiary() {
    const c = document.createElement('div');
    const sorted = [...diaryEntries].sort((a,b) => new Date(b.date)-new Date(a.date));
    const avgEmotion = diaryEntries.length>0 ? (diaryEntries.reduce((s,e)=>s+(e.emotion||5),0)/diaryEntries.length).toFixed(1) : 0;
    
    let html = '<section class="section">';
    html += '<div class="section-header"><h2>📝 Дневник трейдера</h2><button class="btn" id="add-diary-btn">+ Новая запись</button></div>';
    html += '<div class="diary-stats-grid">';
    html += '<div class="stat-card"><h3>Всего записей</h3><div class="stat-value neutral">'+diaryEntries.length+'</div></div>';
    html += '<div class="stat-card"><h3>Среднее настроение</h3><div class="stat-value '+(avgEmotion>=7?'positive':avgEmotion>=4?'warning':'negative')+'">'+avgEmotion+'/10</div></div>';
    html += '<div class="stat-card"><h3>Последняя запись</h3><div class="stat-value neutral" style="font-size:1rem;">'+(sorted.length>0?sorted[0].date:'—')+'</div></div>';
    html += '</div>';
    if (sorted.length > 0) {
      for (let i = 0; i < sorted.length; i++) {
        html += renderDiaryCard(sorted[i]);
      }
    } else {
      html += '<div class="empty-state">Нет записей. Начни вести дневник!</div>';
    }
    html += '</section>';
    c.innerHTML = html;
    const main = document.getElementById('main-content'); main.innerHTML = ''; main.appendChild(c);
  }
  
  function renderDiaryCard(e) {
    const em = emotions.find(x=>x.value===e.emotion) || emotions[4];
    const dayTrades = trades.filter(t => t.date === e.date);
    const dayPnL = dayTrades.reduce((s,t) => s + TradingStats.calculatePnL(t), 0);
    
    let h = '<div class="diary-card">';
    h += '<div class="diary-header">';
    h += '<div><span class="diary-date">'+e.date+'</span> <span style="font-size:2rem;margin-left:0.5rem;">'+em.emoji+'</span> <span style="color:var(--text-secondary);font-size:0.9rem;">'+em.label+' ('+e.emotion+'/10)</span></div>';
    h += '<div class="trade-actions"><button class="edit-diary" data-id="'+e.id+'">✏️</button><button class="delete-diary" data-id="'+e.id+'">🗑️</button></div>';
    h += '</div>';
    if (dayTrades.length > 0) {
      const pnlColor = dayPnL >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
      const pnlSign = dayPnL >= 0 ? '+' : '';
      h += '<div class="diary-section"><h4>📊 Сделки за день ('+dayTrades.length+') — P&L: <span style="color:'+pnlColor+';">'+pnlSign+'$'+dayPnL.toFixed(2)+'</span></h4>';
      h += '<div class="diary-trades-list">';
      for (let i = 0; i < dayTrades.length; i++) {
        const t = dayTrades[i];
        const p = TradingStats.calculatePnL(t);
        const color = p >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
        const sign = p >= 0 ? '+' : '';
        h += '<div class="diary-trade-item"><span>'+t.token+' '+t.time+'</span><span style="color:'+color+';">'+sign+'$'+p.toFixed(2)+'</span></div>';
      }
      h += '</div></div>';
    }
    if (e.wentWell) h += '<div class="diary-section"><h4>✅ Что получилось</h4><div style="font-size:0.95rem;white-space:pre-wrap;">'+e.wentWell+'</div></div>';
    if (e.wentBad) h += '<div class="diary-section"><h4>❌ Что не получилось</h4><div style="font-size:0.95rem;white-space:pre-wrap;">'+e.wentBad+'</div></div>';
    if (e.lessons) h += '<div class="diary-section"><h4>💡 Уроки дня</h4><div style="font-size:0.95rem;white-space:pre-wrap;color:var(--neon-cyan);">'+e.lessons+'</div></div>';
    if (e.notes) h += '<div class="diary-section"><h4>📝 Заметки</h4><div style="font-size:0.9rem;color:var(--text-secondary);white-space:pre-wrap;">'+e.notes+'</div></div>';
    h += '</div>';
    return h;
  }
  
  function openDiaryModal(id) {
    editingDiaryId = id; editingTradeId = null; editingPlanId = null;
    const title = document.getElementById('modal-title');
    title.textContent = id ? 'Редактировать запись' : 'Новая запись в дневник';
    document.getElementById('trade-form').reset();
    const now = new Date();
    document.getElementById('trade-date').value = id ? (diaryEntries.find(d=>d.id===id)?.date || now.toISOString().split('T')[0]) : now.toISOString().split('T')[0];
    document.getElementById('trade-time').value = '20:00';
    ['trade-token','trade-entry','trade-exit','trade-sl','trade-quantity'].forEach(x => document.getElementById(x).value = '');
    document.getElementById('trade-fee').value = '0';
    document.getElementById('trade-risk').value = '2';
    document.getElementById('trade-notes').value = '';
    selectedTags = []; document.getElementById('trade-tags-input').value = '';
    renderSelectedTags();
    const cl = document.querySelector('.checklist-container'); if (cl) cl.remove();
    const em = document.querySelector('.emotion-container'); if (em) em.remove();
    
    const notesField = document.getElementById('trade-notes');
    let emotionHtml = '<div class="emotion-container" style="margin-top:0.5rem;">';
    emotionHtml += '<label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;display:block;margin-bottom:0.5rem;">Настроение:</label>';
    emotionHtml += '<div class="emotion-meter">';
    for (let i = 0; i < emotions.length; i++) {
      const emo = emotions[i];
      const isActive = (id && diaryEntries.find(d=>d.id===id)?.emotion===emo.value) ? 'active' : '';
      emotionHtml += '<button type="button" class="emotion-btn '+isActive+'" data-value="'+emo.value+'" title="'+emo.label+'">'+emo.emoji+'</button>';
    }
    emotionHtml += '</div></div>';
    notesField.parentElement.insertAdjacentHTML('afterend', emotionHtml);
    
    if (id) {
      const entry = diaryEntries.find(d => d.id === id);
      document.getElementById('trade-entry').value = entry.wentWell || '';
      document.getElementById('trade-exit').value = entry.wentBad || '';
      document.getElementById('trade-sl').value = entry.lessons || '';
      document.getElementById('trade-notes').value = entry.notes || '';
    }
    document.getElementById('trade-modal').showModal();
  }
  
  async function saveDiary() {
    const emotionBtn = document.querySelector('.emotion-btn.active');
    const emotion = emotionBtn ? parseInt(emotionBtn.dataset.value) : 5;
    const data = {
      id: editingDiaryId || crypto.randomUUID(), date: document.getElementById('trade-date').value, emotion,
      wentWell: document.getElementById('trade-entry').value, wentBad: document.getElementById('trade-exit').value,
      lessons: document.getElementById('trade-sl').value, notes: document.getElementById('trade-notes').value,
      createdAt: editingDiaryId ? (diaryEntries.find(d=>d.id===editingDiaryId)?.createdAt || Date.now()) : Date.now()
    };
    if (editingDiaryId) await TradingDB.updateDiary(data); else await TradingDB.addDiary(data);
    document.getElementById('trade-modal').close();
    const cl = document.querySelector('.checklist-container'); if (cl) cl.remove();
    const em = document.querySelector('.emotion-container'); if (em) em.remove();
    diaryEntries = await TradingDB.getAllDiary();
    handleNavigation();
  }

  function renderStats() {
    const f = filterTrades(trades, currentPeriod, currentTagFilter);
    const s = TradingStats.calculate(f, initialDeposit);
    const c = document.createElement('div');
    const tokenStats = {}, tagStats = {};
    
    for (let i = 0; i < f.length; i++) {
      const t = f[i];
      const tk = t.token.toUpperCase();
      if (!tokenStats[tk]) tokenStats[tk] = {trades:0,profit:0,wins:0,losses:0};
      const pnl = TradingStats.calculatePnL(t);
      tokenStats[tk].trades++; tokenStats[tk].profit += pnl;
      if (pnl > 0) tokenStats[tk].wins++; else if (pnl < 0) tokenStats[tk].losses++;
      
      if (t.tags) {
        for (let j = 0; j < t.tags.length; j++) {
          const tagKey = t.tags[j].toLowerCase();
          if (!tagStats[tagKey]) tagStats[tagKey]={trades:0,profit:0,wins:0,losses:0,original:t.tags[j]};
          tagStats[tagKey].trades++; tagStats[tagKey].profit+=pnl;
          if (pnl > 0) tagStats[tagKey].wins++; else if (pnl < 0) tagStats[tagKey].losses++;
        }
      }
    }
    
    const tsa = Object.entries(tokenStats).map(([k,v])=>({token:k,...v})).sort((a,b)=>b.profit-a.profit);
    const tsa2 = Object.entries(tagStats).map(([k,v])=>({tag:v.original||k,...v})).sort((a,b)=>b.profit-a.profit);
    const eq = calculateEquityCurve(f);
    const withPnl = f.map(t=>({...t,pnl:TradingStats.calculatePnL(t)})).sort((a,b)=>b.pnl-a.pnl);
    const best = withPnl.filter(t=>t.pnl>0).slice(0,5);
    const worst = withPnl.filter(t=>t.pnl<0).slice(0,5);
    
    let html = renderPeriodFilter() + renderTagFilter();
    
    html += '<section class="section"><div class="section-header"><h2>📈 Equity Curve</h2></div>';
    html += '<div class="stat-card" style="padding:1.5rem;"><canvas id="equity-chart" width="800" height="300" style="width:100%;height:300px;"></canvas></div></section>';
    
    html += '<section class="section"><div class="section-header"><h2>📊 Статистика</h2></div><div class="stats-grid">';
    html += '<div class="stat-card"><h3>Средний выигрыш</h3><div class="stat-value positive">'+TradingStats.formatMoney(s.averageWin)+'</div></div>';
    html += '<div class="stat-card"><h3>Средний проигрыш</h3><div class="stat-value negative">-'+TradingStats.formatMoney(s.averageLoss).replace('+','')+'</div></div>';
    html += '<div class="stat-card"><h3>Соотношение</h3><div class="stat-value neutral">'+(s.averageLoss>0?(s.averageWin/s.averageLoss).toFixed(2):'∞')+'</div></div>';
    html += '<div class="stat-card"><h3>Прибыль</h3><div class="stat-value '+(s.totalProfit>=0?'positive':'negative')+'">'+TradingStats.formatMoney(s.totalProfit)+'</div></div>';
    html += '<div class="stat-card"><h3>Убыток</h3><div class="stat-value negative">-'+TradingStats.formatMoney(s.totalLoss).replace('+','')+'</div></div>';
    html += '<div class="stat-card"><h3>Депозит</h3><div class="stat-value neutral">$'+initialDeposit.toFixed(2)+'</div></div>';
    html += '</div></section>';
    
    html += '<section class="section"><div class="section-header"><h2>🏆 По тегам</h2></div><div class="trades-table">';
    if (tsa2.length > 0) {
      html += '<div class="trade-row header"><div>Тег</div><div>Сделок</div><div>Приб</div><div>Убыт</div><div>WR</div><div>Прибыль</div></div>';
      for (let i = 0; i < tsa2.length; i++) {
        const t = tsa2[i];
        const w = t.trades > 0 ? (t.wins / t.trades * 100).toFixed(0) : 0;
        const cls = t.profit >= 0 ? 'positive' : 'negative';
        html += '<div class="trade-row"><div><span class="tag '+getTagClass(t.tag)+'">'+t.tag+'</span></div>';
        html += '<div>'+t.trades+'</div><div style="color:var(--neon-green);">'+t.wins+'</div>';
        html += '<div style="color:var(--neon-red);">'+t.losses+'</div><div>'+w+'%</div>';
        html += '<div class="trade-pnl '+cls+'">'+TradingStats.formatMoney(t.profit)+'</div></div>';
      }
    } else {
      html += '<div class="empty-state">Нет данных</div>';
    }
    html += '</div></section>';
    
    html += '<section class="section"><div class="section-header"><h2>🏆 По токенам</h2></div><div class="trades-table">';
    if (tsa.length > 0) {
      html += '<div class="trade-row header"><div>Токен</div><div>Сделок</div><div>Приб</div><div>Убыт</div><div>WR</div><div>Прибыль</div></div>';
      for (let i = 0; i < tsa.length; i++) {
        const t = tsa[i];
        const w = t.trades > 0 ? (t.wins / t.trades * 100).toFixed(0) : 0;
        const cls = t.profit >= 0 ? 'positive' : 'negative';
        html += '<div class="trade-row"><div class="trade-token">'+t.token+'</div><div>'+t.trades+'</div>';
        html += '<div style="color:var(--neon-green);">'+t.wins+'</div><div style="color:var(--neon-red);">'+t.losses+'</div>';
        html += '<div>'+w+'%</div><div class="trade-pnl '+cls+'">'+TradingStats.formatMoney(t.profit)+'</div></div>';
      }
    } else {
      html += '<div class="empty-state">Нет данных</div>';
    }
    html += '</div></section>';
    
    html += '<section class="section"><div class="section-header"><h2>📈 Лучшие</h2></div><div class="trades-table">';
    if (best.length > 0) {
      html += '<div class="trade-row header"><div>Дата</div><div>Токен</div><div>Вход/Выход</div><div>Кол-во</div><div></div><div>P&L</div><div></div></div>';
      for (let i = 0; i < best.length; i++) {
        const t = best[i];
        html += '<div class="trade-row"><div class="trade-date">'+t.date+' '+t.time+'</div>';
        html += '<div class="trade-token">'+t.token+'</div><div><div>$'+parseFloat(t.entryPrice).toFixed(6)+'</div>';
        html += '<div>$'+parseFloat(t.exitPrice).toFixed(6)+'</div></div><div>'+parseFloat(t.quantity).toLocaleString()+'</div>';
        html += '<div></div><div class="trade-pnl positive">'+TradingStats.formatMoney(t.pnl)+'</div><div></div></div>';
      }
    } else {
      html += '<div class="empty-state">Нет прибыльных</div>';
    }
    html += '</div></section>';
    
    html += '<section class="section"><div class="section-header"><h2>📉 Худшие</h2></div><div class="trades-table">';
    if (worst.length > 0) {
      html += '<div class="trade-row header"><div>Дата</div><div>Токен</div><div>Вход/Выход</div><div>Кол-во</div><div></div><div>P&L</div><div></div></div>';
      for (let i = 0; i < worst.length; i++) {
        const t = worst[i];
        html += '<div class="trade-row"><div class="trade-date">'+t.date+' '+t.time+'</div>';
        html += '<div class="trade-token">'+t.token+'</div><div><div>$'+parseFloat(t.entryPrice).toFixed(6)+'</div>';
        html += '<div>$'+parseFloat(t.exitPrice).toFixed(6)+'</div></div><div>'+parseFloat(t.quantity).toLocaleString()+'</div>';
        html += '<div></div><div class="trade-pnl negative">'+TradingStats.formatMoney(t.pnl)+'</div><div></div></div>';
      }
    } else {
      html += '<div class="empty-state">Нет убыточных 🎉</div>';
    }
    html += '</div></section>';
    
    c.innerHTML = html;
    const main = document.getElementById('main-content'); 
    main.innerHTML = ''; 
    main.appendChild(c);
    setTimeout(() => drawEquityCurve(eq), 0);
  }
  
  function calculateEquityCurve(list) {
    const s = [...list].sort((a,b)=>new Date(a.date+'T'+a.time)-new Date(b.date+'T'+b.time));
    const d = [{date:'Старт',balance:initialDeposit,pnl:0}];
    let b = initialDeposit;
    for (let i = 0; i < s.length; i++) {
      const t = s[i];
      const p = TradingStats.calculatePnL(t); 
      b += p; 
      d.push({date:t.date.slice(5)+' '+t.time.slice(0,5),balance:b,pnl:p});
    }
    return d;
  }
  
  function drawEquityCurve(data) {
    const cv = document.getElementById('equity-chart');
    if (!cv) return;
    const ctx = cv.getContext('2d'), w = cv.width, h = cv.height, p = 40;
    ctx.clearRect(0,0,w,h);
    if (data.length < 2) { ctx.fillStyle='#a0a0b0'; ctx.font='16px Inter'; ctx.textAlign='center'; ctx.fillText('Недостаточно данных',w/2,h/2); return; }
    const bal = data.map(d=>d.balance), min = Math.min(...bal)*0.95, max = Math.max(...bal)*1.05, rng = max-min||1;
    ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
    for (let i=0;i<=4;i++) { const y=p+(h-2*p)*(i/4); ctx.beginPath(); ctx.moveTo(p,y); ctx.lineTo(w-p,y); ctx.stroke(); ctx.fillStyle='#a0a0b0'; ctx.font='11px Inter'; ctx.textAlign='right'; ctx.fillText('$'+(max-(rng*i/4)).toFixed(2),p-5,y+4); }
    ctx.strokeStyle='#00f3ff'; ctx.lineWidth=2; ctx.beginPath();
    const xs = (w-2*p)/(data.length-1);
    for (let i=0;i<data.length;i++) { const x=p+i*xs, y=p+(h-2*p)*(1-(data[i].balance-min)/rng); if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.stroke();
    const g = ctx.createLinearGradient(0,p,0,h-p); g.addColorStop(0,'rgba(0,243,255,0.3)'); g.addColorStop(1,'rgba(0,243,255,0)');
    ctx.lineTo(p+(data.length-1)*xs,h-p); ctx.lineTo(p,h-p); ctx.closePath(); ctx.fillStyle=g; ctx.fill();
    for (let i=0;i<data.length;i++) { const x=p+i*xs, y=p+(h-2*p)*(1-(data[i].balance-min)/rng); ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle=data[i].pnl>=0?'#00ff9d':'#ff0055'; ctx.fill(); }
    ctx.fillStyle='#a0a0b0'; ctx.font='10px Inter'; ctx.textAlign='center';
    [0,Math.floor(data.length/4),Math.floor(data.length/2),Math.floor(3*data.length/4),data.length-1].forEach(i=>{ctx.fillText(data[i].date,p+i*xs,h-p+15);});
  }

  function renderCalculators() {
    const c = document.createElement('div');
    let html = '<section class="section"><div class="section-header"><h2>🧮 Калькуляторы</h2></div>';
    html += '<div class="calc-grid">';
    html += '<div class="calc-card"><h3>📐 Размер позиции</h3><p class="calc-desc">Сколько купить при риске X%</p>';
    html += '<div class="calc-field"><label>Депозит ($)</label><input type="number" id="calc-deposit" class="form-input" value="'+(initialDeposit||100)+'" step="any"></div>';
    html += '<div class="calc-field"><label>Риск (%)</label><input type="number" id="calc-risk-percent" class="form-input" value="2" step="any"></div>';
    html += '<div class="calc-field"><label>Вход ($)</label><input type="number" id="calc-entry-price" class="form-input" step="any"></div>';
    html += '<div class="calc-field"><label>Stop Loss ($)</label><input type="number" id="calc-sl-price" class="form-input" step="any"></div>';
    html += '<div class="calc-result" id="position-result" style="display:none;"></div></div>';
    html += '<div class="calc-card"><h3>⚖️ Risk/Reward</h3><p class="calc-desc">Оцени сделку</p>';
    html += '<div class="calc-field"><label>Вход ($)</label><input type="number" id="rr-entry" class="form-input" step="any"></div>';
    html += '<div class="calc-field"><label>Stop Loss ($)</label><input type="number" id="rr-sl" class="form-input" step="any"></div>';
    html += '<div class="calc-field"><label>Take Profit ($)</label><input type="number" id="rr-tp" class="form-input" step="any"></div>';
    html += '<div class="calc-field"><label>Количество</label><input type="number" id="rr-qty" class="form-input" step="any"></div>';
    html += '<div class="calc-result" id="rr-result" style="display:none;"></div></div>';
    html += '<div class="calc-card"><h3>📈 Сложный %</h3><p class="calc-desc">Сила регулярной прибыли</p>';
    html += '<div class="calc-field"><label>Капитал ($)</label><input type="number" id="cp-initial" class="form-input" value="'+(initialDeposit||100)+'" step="any"></div>';
    html += '<div class="calc-field"><label>Прибыль (%)</label><input type="number" id="cp-percent" class="form-input" value="5" step="any"></div>';
    html += '<div class="calc-field"><label>Сделок</label><input type="number" id="cp-trades" class="form-input" value="20" step="1"></div>';
    html += '<div class="calc-result" id="cp-result" style="display:none;"></div></div>';
    html += '</div></section>';
    c.innerHTML = html;
    const main = document.getElementById('main-content'); main.innerHTML = ''; main.appendChild(c);
    setupCalculators();
  }
  
  function setupCalculators() {
    ['calc-deposit','calc-risk-percent','calc-entry-price','calc-sl-price'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('input',calcPos);});
    ['rr-entry','rr-sl','rr-tp','rr-qty'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('input',calcRR);});
    ['cp-initial','cp-percent','cp-trades'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('input',calcCP);});
  }
  
  function calcPos() {
    const d=parseFloat(document.getElementById('calc-deposit').value)||0, rp=parseFloat(document.getElementById('calc-risk-percent').value)||0, e=parseFloat(document.getElementById('calc-entry-price').value)||0, s=parseFloat(document.getElementById('calc-sl-price').value)||0;
    const r=document.getElementById('position-result');
    if (!d||!rp||!e||!s) { r.style.display='none'; return; }
    const ra=d*(rp/100), sd=Math.abs(e-s);
    if (sd===0) { r.innerHTML='<div class="calc-result-value warning">⚠️ SL=входу</div>'; r.style.display='block'; return; }
    const ps=ra/sd, pv=ps*e;
    r.innerHTML='<div class="calc-result-row"><span class="calc-result-label">Риск:</span><span class="calc-result-value warning">$'+ra.toFixed(2)+'</span></div><div class="calc-result-row"><span class="calc-result-label">Купить:</span><span class="calc-result-value">'+ps.toLocaleString('en-US',{maximumFractionDigits:4})+'</span></div><div class="calc-result-row"><span class="calc-result-label">Сумма:</span><span class="calc-result-value">$'+pv.toFixed(2)+'</span></div>';
    r.style.display='block';
  }
  
  function calcRR() {
    const e=parseFloat(document.getElementById('rr-entry').value)||0, s=parseFloat(document.getElementById('rr-sl').value)||0, t=parseFloat(document.getElementById('rr-tp').value)||0, q=parseFloat(document.getElementById('rr-qty').value)||0;
    const r=document.getElementById('rr-result');
    if (!e||!s||!t||!q) { r.style.display='none'; return; }
    const risk=Math.abs(e-s)*q, rew=Math.abs(t-e)*q, rr=risk>0?rew/risk:0;
    let rc='neutral',re='⚖️',rt='Нейтрально';
    if (rr>=3){rc='positive';re='🎯';rt='Отличная';}else if(rr>=2){rc='positive';re='✅';rt='Хорошая';}else if(rr>=1){rc='warning';re='⚠️';rt='Приемлемая';}else{rc='negative';re='❌';rt='Плохая';}
    r.innerHTML='<div class="calc-result-row"><span class="calc-result-label">Риск:</span><span class="calc-result-value negative">-$'+risk.toFixed(2)+'</span></div><div class="calc-result-row"><span class="calc-result-label">Прибыль:</span><span class="calc-result-value positive">+$'+rew.toFixed(2)+'</span></div><div class="calc-result-row"><span class="calc-result-label">R:R:</span><span class="calc-result-value '+rc+'">'+re+' 1:'+rr.toFixed(2)+'</span></div><div class="calc-result-row"><span class="calc-result-label">Оценка:</span><span class="calc-result-value '+rc+'">'+rt+'</span></div>';
    r.style.display='block';
  }
  
  function calcCP() {
    const i=parseFloat(document.getElementById('cp-initial').value)||0, p=parseFloat(document.getElementById('cp-percent').value)||0, n=parseInt(document.getElementById('cp-trades').value)||0;
    const r=document.getElementById('cp-result');
    if (!i||!p||!n) { r.style.display='none'; return; }
    const m=1+(p/100), fa=i*Math.pow(m,n), sa=i+(i*(p/100)*n), pr=fa-i, pp=((fa-i)/i)*100, cb=fa-sa;
    r.innerHTML='<div class="calc-result-row"><span class="calc-result-label">Итого:</span><span class="calc-result-value positive">$'+fa.toFixed(2)+'</span></div><div class="calc-result-row"><span class="calc-result-label">Прибыль:</span><span class="calc-result-value positive">+$'+pr.toFixed(2)+' (+'+pp.toFixed(1)+'%)</span></div><div class="calc-result-row"><span class="calc-result-label">Простой %:</span><span class="calc-result-value">$'+sa.toFixed(2)+'</span></div><div class="calc-result-row"><span class="calc-result-label">Бонус:</span><span class="calc-result-value positive">+$'+cb.toFixed(2)+'</span></div>';
    r.style.display='block';
  }

  function renderSettings() {
    const m = document.getElementById('main-content');
    const ns = typeof Notifications !== 'undefined' ? Notifications.tradingSettings : {};
    const notifEnabled = typeof Notifications !== 'undefined' && Notification.permission === 'granted';
    const isAuth = typeof FirebaseClient !== 'undefined' && FirebaseClient.isAuthenticated();
    const userEmail = isAuth ? FirebaseClient.getCurrentUser()?.email : (localStorage.getItem('guest_mode') === 'true' ? 'Гость' : 'Не авторизован');
    
    let html = '<section class="section"><div class="section-header"><h2>⚙️ Настройки</h2></div>';
    html += '<div class="notif-section"><h3>👤 Аккаунт</h3>';
    html += '<div style="margin-bottom: 1rem;"><span style="color: var(--text-secondary); font-size: 0.9rem;">Email: </span>';
    html += '<span class="notif-status '+(isAuth ? 'enabled' : 'disabled')+'">'+userEmail+'</span></div>';
    html += '<button class="btn btn-secondary" id="logout-btn" style="margin-bottom: 1rem;">🚪 Выйти</button></div>';
    html += '<div class="notif-section"><h3>🔔 Уведомления и алерты</h3>';
    html += '<div style="margin-bottom: 1rem;"><span style="color: var(--text-secondary); font-size: 0.9rem;">Статус: </span>';
    html += '<span class="notif-status '+(notifEnabled ? 'enabled' : 'disabled')+'">'+(notifEnabled ? '✅ Включены' : '❌ Выключены')+'</span></div>';
    html += '<div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">';
    html += '<button class="btn" id="enable-notif-btn">'+(notifEnabled ? '🔕 Выключить' : '🔔 Включить уведомления')+'</button>';
    html += '<button class="btn btn-secondary" id="test-notif-btn">🧪 Тест</button></div>';
    html += '<div class="notif-row"><label>Алерты по ценам (планы)</label><div class="toggle-container"><button class="toggle '+(ns.priceAlerts ? 'active' : '')+'" data-alert="priceAlerts"></button></div></div>';
    html += '<div class="notif-row"><label>Алерты по портфелю</label><div class="toggle-container"><button class="toggle '+(ns.portfolioAlerts ? 'active' : '')+'" data-alert="portfolioAlerts"></button></div></div>';
    html += '<div class="notif-row"><label>Напоминания</label><div class="toggle-container"><button class="toggle '+(ns.reminders ? 'active' : '')+'" data-alert="reminders"></button></div></div>';
    html += '<div class="notif-row"><label>Звук</label><div class="toggle-container"><button class="toggle '+(ns.sound ? 'active' : '')+'" data-alert="sound"></button></div></div>';
    html += '<div class="notif-row"><label>Просадка портфеля (%)</label><input type="number" id="alert-drawdown" value="'+ns.drawdownPercent+'" min="1" max="50"></div>';
    html += '<div class="notif-row"><label>Серия убытков (сделок)</label><input type="number" id="alert-losing-streak" value="'+ns.losingStreak+'" min="2" max="10"></div>';
    html += '<div class="notif-row"><label>Дневной лимит убытков (%)</label><input type="number" id="alert-daily-loss" value="'+ns.dailyLossLimit+'" min="1" max="20"></div>';
    html += '<div class="notif-row"><label>Время напоминания</label><input type="time" id="alert-reminder-time" value="'+ns.reminderTime+'"></div>';
    html += '<button class="btn" id="save-alert-settings" style="margin-top: 1rem;">💾 Сохранить настройки</button></div>';
    html += '<div class="stat-card" style="margin-bottom:1rem;"><h3 style="margin-bottom:1rem;">Начальный депозит</h3>';
    html += '<div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;">';
    html += '<input type="number" id="settings-deposit" class="form-input" value="'+initialDeposit+'" step="any" style="max-width:200px;">';
    html += '<button class="btn" id="save-deposit-btn">Сохранить</button></div></div>';
    html += '<div class="stat-card" style="margin-bottom:1rem;"><h3 style="margin-bottom:1rem;">🏷️ Теги</h3>';
    html += '<div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">';
    html += '<input type="text" id="new-tag-input" class="form-input" placeholder="Новый тег..." style="max-width:200px;">';
    html += '<button class="btn" id="add-new-tag-btn">Добавить</button></div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">';
    for (let i = 0; i < availableTags.length; i++) {
      const t = availableTags[i];
      html += '<span class="tag '+getTagClass(t)+'" style="display:inline-flex;align-items:center;gap:0.3rem;">'+t+'<span class="remove-tag delete-tag-btn" data-tag="'+t+'" style="cursor:pointer;">&times;</span></span>';
    }
    html += '</div></div>';
    html += '<div class="stat-card" style="margin-bottom:1rem;"><h3 style="margin-bottom:1rem;">📦 Экспорт</h3><button class="btn" id="export-btn">📥 Скачать JSON</button></div>';
    html += '<div class="stat-card" style="margin-bottom:1rem;"><h3 style="margin-bottom:1rem;">📤 Импорт</h3>';
    html += '<input type="file" id="import-file" accept=".json" style="display:none;">';
    html += '<button class="btn btn-secondary" id="import-btn">Выбрать файл</button>';
    html += '<div id="import-result" style="margin-top:0.5rem;font-size:0.9rem;"></div></div>';
    html += '<div class="stat-card" style="border-color:rgba(255,0,85,0.3);"><h3 style="margin-bottom:1rem;color:var(--neon-red);">⚠️ Опасная зона</h3><button class="btn btn-danger" id="clear-all-btn">🗑️ Удалить всё</button></div>';
    html += '</section>';
    
    m.innerHTML = html;

    const imp = document.getElementById('import-file');
    if (imp) imp.addEventListener('change', handleImport);

    document.getElementById('enable-notif-btn').addEventListener('click', async () => {
      if (typeof Notifications === 'undefined') return;
      if (!notifEnabled) {
        const ok = await Notifications.requestPermission();
        if (ok === 'granted') { Notifications.startPeriodicCheck(); renderSettings(); }
      } else {
        Notifications.stopPeriodicCheck();
        renderSettings();
      }
    });

    document.getElementById('test-notif-btn').addEventListener('click', () => {
      if (typeof Notifications !== 'undefined') {
        Notifications.showToast('Тестовое уведомление работает! 🎉', 'success');
      }
    });

    document.querySelectorAll('.toggle[data-alert]').forEach(toggle => {
      toggle.addEventListener('click', () => { toggle.classList.toggle('active'); });
    });

    document.getElementById('save-alert-settings').addEventListener('click', () => {
      const settings = {
        drawdownPercent: parseFloat(document.getElementById('alert-drawdown').value) || 10,
        losingStreak: parseInt(document.getElementById('alert-losing-streak').value) || 3,
        dailyLossLimit: parseFloat(document.getElementById('alert-daily-loss').value) || 5,
        reminderTime: document.getElementById('alert-reminder-time').value || '20:00',
        priceAlerts: document.querySelector('.toggle[data-alert="priceAlerts"]')?.classList.contains('active') ?? true,
        portfolioAlerts: document.querySelector('.toggle[data-alert="portfolioAlerts"]')?.classList.contains('active') ?? true,
        reminders: document.querySelector('.toggle[data-alert="reminders"]')?.classList.contains('active') ?? true,
        sound: document.querySelector('.toggle[data-alert="sound"]')?.classList.contains('active') ?? true
      };
      if (typeof Notifications !== 'undefined') {
        Notifications.saveTradingSettings(settings);
      }
      alert('✅ Настройки алертов сохранены!');
    });
  }
  
  function exportData() {
    const d = {version:1,exportDate:new Date().toISOString(),initialDeposit,availableTags,trades,plans,diaryEntries};
    const b = new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
    const u = URL.createObjectURL(b), a = document.createElement('a');
    a.href=u; a.download='trading-backup-'+new Date().toISOString().split('T')[0]+'.json'; a.click(); URL.revokeObjectURL(u);
  }
  
  async function handleImport(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = document.getElementById('import-result'); if (!r) return;
    r.style.color='var(--neon-cyan)'; r.textContent='⏳ Загрузка...';
    try {
      const t = await f.text(), d = JSON.parse(t);
      if (!d.trades||!Array.isArray(d.trades)) throw new Error('Неверный формат');
      if (!confirm('Импортировать '+d.trades.length+' сделок?')) { r.textContent='❌ Отменено'; r.style.color='var(--neon-yellow)'; return; }
      for (let i = 0; i < trades.length; i++) await TradingDB.delete(trades[i].id);
      for (let i = 0; i < d.trades.length; i++) await TradingDB.add(d.trades[i]);
      if (d.plans) { for (let i = 0; i < plans.length; i++) await TradingDB.deletePlan(plans[i].id); for (let i = 0; i < d.plans.length; i++) await TradingDB.addPlan(d.plans[i]); }
      if (d.diaryEntries) { for (let i = 0; i < diaryEntries.length; i++) await TradingDB.deleteDiary(diaryEntries[i].id); for (let i = 0; i < d.diaryEntries.length; i++) await TradingDB.addDiary(d.diaryEntries[i]); }
      if (d.initialDeposit!==undefined) { await TradingDB.saveSetting('initialDeposit',d.initialDeposit); initialDeposit=d.initialDeposit; }
      if (d.availableTags) { availableTags=d.availableTags; await TradingDB.saveSetting('availableTags',availableTags); }
      trades=await TradingDB.getAll(); plans=await TradingDB.getAllPlans(); diaryEntries=await TradingDB.getAllDiary();
      TradingStats.clearCache();
      r.style.color='var(--neon-green)'; r.textContent='✅ Импортировано '+d.trades.length+' сделок';
      setTimeout(()=>handleNavigation(),1500);
    } catch(err) { r.style.color='var(--neon-red)'; r.textContent='❌ Ошибка: '+err.message; }
  }

  function openTradeModal(id) {
    const title = document.getElementById('modal-title');
    editingTradeId = id; editingPlanId = null; editingDiaryId = null; selectedTags = [];
    const cl = document.querySelector('.checklist-container'); if (cl) cl.remove();
    const em = document.querySelector('.emotion-container'); if (em) em.remove();
    if (id) {
      const t = trades.find(x=>x.id===id);
      title.textContent = 'Редактировать сделку';
      document.getElementById('trade-date').value = t.date;
      document.getElementById('trade-time').value = t.time;
      document.getElementById('trade-token').value = t.token;
      document.getElementById('trade-entry').value = t.entryPrice;
      document.getElementById('trade-exit').value = t.exitPrice;
      document.getElementById('trade-sl').value = t.sl || '';
      document.getElementById('trade-quantity').value = t.quantity;
      document.getElementById('trade-fee').value = t.fee || 0;
      document.getElementById('trade-risk').value = t.riskPercent || 2;
      document.getElementById('trade-notes').value = t.notes || '';
      selectedTags = t.tags || [];
      document.getElementById('trade-tags-input').value = selectedTags.join(', ');
    } else {
      title.textContent = 'Новая сделка';
      document.getElementById('trade-form').reset();
      const now = new Date();
      document.getElementById('trade-date').valueAsDate = now;
      document.getElementById('trade-time').value = now.toTimeString().slice(0,5);
      document.getElementById('trade-risk').value = 2;
      document.getElementById('trade-tags-input').value = '';
    }
    renderSelectedTags();
    document.getElementById('trade-modal').showModal();
  }
  
  async function saveTrade() {
    const tagsInput = document.getElementById('trade-tags-input').value.trim();
    const parsedTags = tagsInput ? tagsInput.split(/[,;\s]+/).filter(t => t.length > 0).map(t => t.toLowerCase()) : [];
    const allTags = [...new Set([...selectedTags, ...parsedTags])];
    
    const d = {
      id: editingTradeId || crypto.randomUUID(), date: document.getElementById('trade-date').value, time: document.getElementById('trade-time').value,
      token: document.getElementById('trade-token').value.toUpperCase(), entryPrice: parseFloat(document.getElementById('trade-entry').value),
      exitPrice: parseFloat(document.getElementById('trade-exit').value), sl: parseFloat(document.getElementById('trade-sl').value) || 0,
      quantity: parseFloat(document.getElementById('trade-quantity').value), fee: parseFloat(document.getElementById('trade-fee').value) || 0,
      riskPercent: parseFloat(document.getElementById('trade-risk').value) || 2, notes: document.getElementById('trade-notes').value,
      tags: allTags, direction: 'long', createdAt: Date.now()
    };
    
    if (editingTradeId) await TradingDB.update(d); else await TradingDB.add(d);
    document.getElementById('trade-modal').close();
    const cl = document.querySelector('.checklist-container'); if (cl) cl.remove();
    const em = document.querySelector('.emotion-container'); if (em) em.remove();
    trades = await TradingDB.getAll();
    TradingStats.clearCache();
    if (!availableTokens.includes(d.token)) { availableTokens.push(d.token); availableTokens.sort(); }
    handleNavigation();
  }
});