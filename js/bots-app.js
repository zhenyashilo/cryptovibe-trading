document.addEventListener('DOMContentLoaded', () => {
  const els = {
    main: document.getElementById('main-content'),
    modal: document.getElementById('tx-modal'),
    openBtn: document.getElementById('open-modal-btn'),
    closeBtn: document.getElementById('close-modal-btn'),
    form: document.getElementById('tx-form'),
    modalTitle: document.getElementById('modal-title'),
    exportBtn: document.getElementById('export-btn'),
    amountInput: document.getElementById('tx-amount'),
    hintAmount: document.getElementById('hint-amount'),
    dateInput: document.getElementById('tx-date'),
    nameInput: document.getElementById('tx-name')
  };

  let transactions = [];
  let editingTxId = null;

  const formatMoney = (n) => {
    const val = parseFloat(n) || 0;
    return (val >= 0 ? '+' : '') + '$' + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatMoneyPlain = (n) => '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatGram = (n) => {
    const val = parseFloat(n) || 0;
    return (val >= 0 ? '+' : '') + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' GRAM';
  };

  const getPeriodFilter = (period) => {
    const now = new Date();
    const cutoff = new Date();
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    else return null;
    return cutoff;
  };

  const filterByPeriod = (txs, period = 'all') => {
    const cutoff = getPeriodFilter(period);
    if (!cutoff) return txs;
    return txs.filter(tx => new Date(tx.date) >= cutoff);
  };

  const getUniqueBotNames = () => {
    const names = new Set();
    transactions.forEach(tx => {
      if (tx.name && tx.name !== 'Не указано' && ['earning_invest', 'earning_payout'].includes(tx.type)) {
        names.add(tx.name.toUpperCase());
      }
    });
    return Array.from(names).sort();
  };

  const initNameAutocomplete = () => {
    const input = els.nameInput;
    if (!input) return;
    
    const oldList = input.parentElement.querySelector('.autocomplete-suggestions');
    if (oldList) oldList.remove();
    
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'autocomplete-suggestions';
    suggestionsList.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--bg-secondary);
      border: var(--glass-border);
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 100;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      display: none;
    `;
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(suggestionsList);

    const renderSuggestions = () => {
      const value = input.value.toUpperCase().trim();
      if (value.length < 1) {
        suggestionsList.style.display = 'none';
        return;
      }

      const names = getUniqueBotNames();
      const matches = names.filter(name => name.includes(value));

      if (matches.length === 0) {
        suggestionsList.style.display = 'none';
        return;
      }

      suggestionsList.innerHTML = matches.slice(0, 10).map(name => {
        const isExact = name === value;
        return `
          <div class="autocomplete-item" data-name="${name}" style="
            padding: 0.75rem;
            cursor: pointer;
            transition: background 0.15s;
            font-size: 0.95rem;
            ${isExact ? 'background: rgba(0, 255, 157, 0.05);' : ''}
          ">${name}${isExact ? ' <span style="font-size:0.7rem; color:var(--neon-green);">(уже есть)</span>' : ''}</div>
        `;
      }).join('');

      suggestionsList.style.display = 'block';

      suggestionsList.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(0, 255, 157, 0.15)';
          item.style.color = 'var(--neon-green)';
        });
        item.addEventListener('mouseleave', () => {
          const isExact = item.dataset.name === value;
          item.style.background = isExact ? 'rgba(0, 255, 157, 0.05)' : '';
          item.style.color = '';
        });
        item.addEventListener('click', () => {
          input.value = item.dataset.name;
          suggestionsList.style.display = 'none';
          input.focus();
        });
      });
    };

    input.addEventListener('input', renderSuggestions);
    input.addEventListener('focus', renderSuggestions);

    document.addEventListener('click', (e) => {
      if (!input.parentElement.contains(e.target)) {
        suggestionsList.style.display = 'none';
      }
    });
  };

  const initCustomSelects = () => {
    document.querySelectorAll('.custom-select').forEach(selectEl => {
      const trigger = selectEl.querySelector('.custom-select-trigger');
      const list = selectEl.querySelector('.custom-select-list');
      const hiddenInput = selectEl.querySelector('input[type="hidden"]');
      const selectedText = trigger.querySelector('.selected-text');

      if (!trigger || !list || !hiddenInput || !selectedText) return;

      const closeDropdown = () => {
        list.classList.remove('open');
        selectEl.setAttribute('aria-expanded', 'false');
      };

      const selectOption = (option) => {
        list.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const span = option.querySelector('span');
        if (span) selectedText.textContent = span.textContent;
        hiddenInput.value = option.dataset.value;
        closeDropdown();
        selectEl.dispatchEvent(new CustomEvent('selectchange', { 
          detail: { value: option.dataset.value } 
        }));
      };

      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = list.classList.contains('open');
        document.querySelectorAll('.custom-select-list.open').forEach(l => {
          if (l !== list) l.classList.remove('open');
        });
        if (!isOpen) {
          list.classList.add('open');
          selectEl.setAttribute('aria-expanded', 'true');
        } else {
          closeDropdown();
        }
      });

      list.addEventListener('click', (e) => {
        const option = e.target.closest('.custom-select-option');
        if (option) {
          e.stopPropagation();
          selectOption(option);
        }
      });

      document.addEventListener('click', (e) => {
        if (!selectEl.contains(e.target)) closeDropdown();
      });
    });
  };

  const updateFormUI = (type) => {
    if (!type) return;
    const hint = els.hintAmount;
    if (hint) {
      hint.textContent = type === 'earning_invest' ? 'Сколько пополнили' : 'Сколько получили';
    }
  };

  const resetCustomSelect = (selector, defaultValue) => {
    const selectEl = document.querySelector(selector);
    if (!selectEl) return;
    selectEl.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    const first = Array.from(selectEl.querySelectorAll('.custom-select-option'))
      .find(o => o.dataset.value === defaultValue) || selectEl.querySelector('.custom-select-option');
    if (first) {
      first.classList.add('selected');
      const span = first.querySelector('span');
      if (span) selectEl.querySelector('.selected-text').textContent = span.textContent;
      selectEl.querySelector('input[type="hidden"]').value = first.dataset.value;
    }
  };

  if (els.openBtn) {
    els.openBtn.addEventListener('click', () => {
      editingTxId = null;
      els.modalTitle.textContent = 'Новая операция';
      els.form.reset();
      els.dateInput.valueAsDate = new Date();
      resetCustomSelect('[data-select="type"]', 'earning_invest');
      resetCustomSelect('[data-select="currency"]', 'USDT');
      updateFormUI('earning_invest');
      els.modal.showModal();
    });
  }

  if (els.closeBtn) {
    els.closeBtn.addEventListener('click', () => els.modal.close());
  }
  
  if (els.modal) {
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) els.modal.close();
    });
  }

  const typeSelect = document.querySelector('[data-select="type"]');
  if (typeSelect) {
    typeSelect.addEventListener('selectchange', (e) => updateFormUI(e.detail.value));
  }

  const aggregateBots = (txs) => {
    const bots = {};
    
    txs.forEach(tx => {
      if (!['earning_invest', 'earning_payout'].includes(tx.type)) return;
      
      const name = (tx.name || 'Неизвестно').toUpperCase();
      if (!bots[name]) {
        bots[name] = { 
          name,
          investedUSDT: 0,
          investedGRAM: 0,
          returnedUSDT: 0,
          returnedGRAM: 0,
          investCount: 0,
          payoutCount: 0,
          operations: []
        };
      }
      const b = bots[name];
      b.operations.push(tx);
      
      const amount = parseFloat(tx.amount || tx.usdtValue) || 0;
      const currency = (tx.currency || 'USDT').toUpperCase();
      
      if (tx.type === 'earning_invest') {
        b.investCount++;
        if (currency === 'GRAM') {
          b.investedGRAM += amount;
        } else {
          b.investedUSDT += amount;
        }
      } else if (tx.type === 'earning_payout') {
        b.payoutCount++;
        if (currency === 'GRAM') {
          b.returnedGRAM += amount;
        } else {
          b.returnedUSDT += amount;
        }
      }
    });
    
    return Object.values(bots).map(b => {
      if (b.returnedUSDT >= b.investedUSDT) {
        b.profitUSDT = b.returnedUSDT - b.investedUSDT;
      } else {
        b.profitUSDT = 0;
      }
      
      if (b.returnedGRAM >= b.investedGRAM) {
        b.profitGRAM = b.returnedGRAM - b.investedGRAM;
      } else {
        b.profitGRAM = 0;
      }
      
      b.roiUSDT = b.investedUSDT > 0 ? ((b.profitUSDT / b.investedUSDT) * 100).toFixed(2) : (b.profitUSDT > 0 ? '∞' : '0');
      b.roiGRAM = b.investedGRAM > 0 ? ((b.profitGRAM / b.investedGRAM) * 100).toFixed(2) : (b.profitGRAM > 0 ? '∞' : '0');
      
      return b;
    });
  };

  const calculateBotStats = (txs) => {
    let investedUSDT = 0, returnedUSDT = 0, investedGRAM = 0, returnedGRAM = 0;
    txs.forEach(tx => {
      if (!['earning_invest', 'earning_payout'].includes(tx.type)) return;
      const amount = parseFloat(tx.amount || tx.usdtValue) || 0;
      const currency = (tx.currency || 'USDT').toUpperCase();
      
      if (tx.type === 'earning_invest') {
        if (currency === 'GRAM') investedGRAM += amount;
        else investedUSDT += amount;
      } else if (tx.type === 'earning_payout') {
        if (currency === 'GRAM') returnedGRAM += amount;
        else returnedUSDT += amount;
      }
    });
    
    const profitUSDT = returnedUSDT >= investedUSDT ? returnedUSDT - investedUSDT : 0;
    const profitGRAM = returnedGRAM >= investedGRAM ? returnedGRAM - investedGRAM : 0;
    const roiUSDT = investedUSDT > 0 ? ((profitUSDT / investedUSDT) * 100).toFixed(2) : (profitUSDT > 0 ? '∞' : '0');
    const roiGRAM = investedGRAM > 0 ? ((profitGRAM / investedGRAM) * 100).toFixed(2) : (profitGRAM > 0 ? '∞' : '0');
    
    return { 
      investedUSDT, investedGRAM, 
      returnedUSDT, returnedGRAM, 
      profitUSDT, profitGRAM,
      roiUSDT, roiGRAM
    };
  };

  const calculatePeriodBotProfit = (txs, period, currency = 'USDT') => {
    const filtered = filterByPeriod(txs, period);
    let invested = 0, returned = 0;
    
    filtered.forEach(tx => {
      if (!['earning_invest', 'earning_payout'].includes(tx.type)) return;
      const amount = parseFloat(tx.amount || tx.usdtValue) || 0;
      const txCurrency = (tx.currency || 'USDT').toUpperCase();
      if (txCurrency !== currency) return;
      
      if (tx.type === 'earning_invest') invested += amount;
      else if (tx.type === 'earning_payout') returned += amount;
    });
    
    return returned >= invested ? returned - invested : 0;
  };

  const getBadgeClass = (type) => {
    if (type === 'earning_invest') return 'badge-earning-invest';
    if (type === 'earning_payout') return 'badge-earning-payout';
    return 'badge-custom';
  };

  const renderTxItem = (tx) => {
    const amount = parseFloat(tx.amount || tx.usdtValue) || 0;
    const currency = (tx.currency || 'USDT').toUpperCase();
    const isPositive = tx.type === 'earning_payout';
    const isNegative = tx.type === 'earning_invest';
    const typeLabel = tx.type === 'earning_invest' ? 'Пополнение' : 'Выплата';
    const displayText = `${amount.toLocaleString('en-US')} ${currency}`;

    return `
      <article class="tx-item">
        <div class="tx-info">
          <h4><span class="tx-badge ${getBadgeClass(tx.type)}">${typeLabel}</span> ${tx.name || 'Без названия'}</h4>
          <div class="tx-meta">${tx.date} • ${displayText}</div>
        </div>
        <div class="tx-amount ${isPositive ? 'pos' : (isNegative ? 'neg' : '')}">
          ${isPositive ? '+' : '-'}${currency === 'USDT' ? '$' : ''}${amount.toFixed(2)}${currency === 'GRAM' ? ' GRAM' : ''}
        </div>
        <div class="tx-actions">
          <button class="tx-action-btn edit" data-id="${tx.id}">✏️</button>
          <button class="tx-action-btn delete" data-id="${tx.id}">🗑️</button>
        </div>
      </article>
    `;
  };

  const renderBotsView = () => {
    const bots = aggregateBots(transactions);
    const stats = calculateBotStats(transactions);

    return `
      <header class="page-header">
        <h1>Боты для заработка</h1>
        <p>Учёт пополнений и выплат (только USDT и GRAM)</p>
      </header>
      
      <section class="stats-grid">
        <article class="stat-card">
          <h3>Активных ботов</h3>
          <p class="metric-value">${bots.length}</p>
        </article>
        <article class="stat-card">
          <h3>Вложено USDT</h3>
          <p class="metric-value">${formatMoneyPlain(stats.investedUSDT)}</p>
        </article>
        <article class="stat-card">
          <h3>Вложено GRAM</h3>
          <p class="metric-value">${stats.investedGRAM.toFixed(2)} GRAM</p>
        </article>
        <article class="stat-card">
          <h3>Получено USDT</h3>
          <p class="metric-value positive">${formatMoneyPlain(stats.returnedUSDT)}</p>
        </article>
        <article class="stat-card">
          <h3>Получено GRAM</h3>
          <p class="metric-value positive">${stats.returnedGRAM.toFixed(2)} GRAM</p>
        </article>
        <article class="stat-card">
          <h3>Прибыль (USDT)</h3>
          <p class="metric-value ${stats.profitUSDT >= 0 ? 'positive' : 'negative'}">${formatMoney(stats.profitUSDT)}</p>
        </article>
        <article class="stat-card">
          <h3>Прибыль (GRAM)</h3>
          <p class="metric-value ${stats.profitGRAM >= 0 ? 'positive' : 'negative'}">${formatGram(stats.profitGRAM)}</p>
        </article>
      </section>

      <div class="token-list">
        ${bots.length > 0 ? bots.map(b => `
          <a href="#/bot/${encodeURIComponent(b.name)}" class="token-item">
            <div class="token-info">
              <div class="token-icon">💰</div>
              <div>
                <div class="token-name">${b.name}</div>
                <div class="token-sub">${b.investCount} пополнений • ${b.payoutCount} выплат</div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
                  ${b.investedUSDT > 0 ? `<span class="token-quantity">Вложено: ${formatMoneyPlain(b.investedUSDT)}</span>` : ''}
                  ${b.investedGRAM > 0 ? `<span class="token-quantity" style="background: rgba(0, 255, 157, 0.08); color: var(--neon-green);">+ ${b.investedGRAM.toFixed(2)} GRAM</span>` : ''}
                </div>
              </div>
            </div>
            <div class="token-stats">
              <div class="token-value">${formatMoneyPlain(b.returnedUSDT)}</div>
              <div class="token-profit ${b.profitUSDT >= 0 ? 'pos' : 'neg'}">${formatMoney(b.profitUSDT)} USDT</div>
              ${b.profitGRAM > 0 ? `<div class="token-profit pos">+${b.profitGRAM.toFixed(2)} GRAM</div>` : ''}
            </div>
          </a>
        `).join('') : '<div class="empty-state">Нет данных по ботам для заработка</div>'}
      </div>
    `;
  };

  const renderBotDetailView = (botName) => {
    const name = decodeURIComponent(botName).toUpperCase();
    const botTxs = transactions.filter(tx => (tx.name || '').toUpperCase() === name && ['earning_invest', 'earning_payout'].includes(tx.type));
    
    if (botTxs.length === 0) {
      return `<button class="back-btn" onclick="history.back()">← Назад</button><div class="empty-state">Бот не найден</div>`;
    }

    const bots = aggregateBots(botTxs);
    const bot = bots[0];
    if (!bot) {
      return `<button class="back-btn" onclick="history.back()">← Назад</button><div class="empty-state">Бот не найден</div>`;
    }

    const profitUSDTWeek = calculatePeriodBotProfit(botTxs, 'week', 'USDT');
    const profitUSDTMonth = calculatePeriodBotProfit(botTxs, 'month', 'USDT');
    const profitUSDTYear = calculatePeriodBotProfit(botTxs, 'year', 'USDT');

    const profitGRAMWeek = calculatePeriodBotProfit(botTxs, 'week', 'GRAM');
    const profitGRAMMonth = calculatePeriodBotProfit(botTxs, 'month', 'GRAM');
    const profitGRAMYear = calculatePeriodBotProfit(botTxs, 'year', 'GRAM');

    return `
      <button class="back-btn" onclick="history.back()">← Назад</button>
      <div class="token-detail-header">
        <div class="token-icon">💰</div>
        <div>
          <h1>${name}</h1>
          <p style="color: var(--text-secondary);">Бот для заработка • ${bot.operations.length} операций</p>
        </div>
      </div>
      
      <section class="detail-grid">
        <div class="detail-card">
          <label>Вложено USDT</label>
          <div class="value">${formatMoneyPlain(bot.investedUSDT)}</div>
        </div>
        <div class="detail-card">
          <label>Вложено GRAM</label>
          <div class="value">${bot.investedGRAM.toFixed(2)} GRAM</div>
        </div>
        <div class="detail-card">
          <label>Получено USDT</label>
          <div class="value positive">${formatMoneyPlain(bot.returnedUSDT)}</div>
        </div>
        <div class="detail-card">
          <label>Получено GRAM</label>
          <div class="value positive">${bot.returnedGRAM.toFixed(2)} GRAM</div>
        </div>
        <div class="detail-card">
          <label>Прибыль (USDT)</label>
          <div class="value ${bot.profitUSDT >= 0 ? 'positive' : 'negative'}">${formatMoney(bot.profitUSDT)}</div>
        </div>
        <div class="detail-card">
          <label>Прибыль (GRAM)</label>
          <div class="value ${bot.profitGRAM >= 0 ? 'positive' : 'negative'}">${formatGram(bot.profitGRAM)}</div>
        </div>
        <div class="detail-card">
          <label>ROI (USDT)</label>
          <div class="value ${bot.profitUSDT >= 0 ? 'positive' : 'negative'}">${bot.roiUSDT}%</div>
        </div>
        <div class="detail-card">
          <label>ROI (GRAM)</label>
          <div class="value ${bot.profitGRAM >= 0 ? 'positive' : 'negative'}">${bot.roiGRAM}%</div>
        </div>
      </section>

      <section class="section">
        <div class="section-header"><h2>Прибыль по периодам (USDT)</h2></div>
        <div class="detail-grid">
          <div class="detail-card">
            <label>За 7 дней</label>
            <div class="value ${profitUSDTWeek >= 0 ? 'positive' : 'negative'}">${formatMoney(profitUSDTWeek)}</div>
          </div>
          <div class="detail-card">
            <label>За 30 дней</label>
            <div class="value ${profitUSDTMonth >= 0 ? 'positive' : 'negative'}">${formatMoney(profitUSDTMonth)}</div>
          </div>
          <div class="detail-card">
            <label>За год</label>
            <div class="value ${profitUSDTYear >= 0 ? 'positive' : 'negative'}">${formatMoney(profitUSDTYear)}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header"><h2>Прибыль по периодам (GRAM)</h2></div>
        <div class="detail-grid">
          <div class="detail-card">
            <label>За 7 дней</label>
            <div class="value ${profitGRAMWeek >= 0 ? 'positive' : 'negative'}">${formatGram(profitGRAMWeek)}</div>
          </div>
          <div class="detail-card">
            <label>За 30 дней</label>
            <div class="value ${profitGRAMMonth >= 0 ? 'positive' : 'negative'}">${formatGram(profitGRAMMonth)}</div>
          </div>
          <div class="detail-card">
            <label>За год</label>
            <div class="value ${profitGRAMYear >= 0 ? 'positive' : 'negative'}">${formatGram(profitGRAMYear)}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header"><h2>История операций</h2></div>
        <div class="tx-list">
          ${bot.operations.sort((a, b) => new Date(b.date) - new Date(a.date)).map(tx => renderTxItem(tx)).join('')}
        </div>
      </section>
    `;
  };

  BotsRouter.register('#/bots', () => {
    els.main.innerHTML = renderBotsView();
    bindTxActions();
  });

  BotsRouter.register('#/bot', (params) => {
    els.main.innerHTML = renderBotDetailView(params[0] || '');
    bindTxActions();
  });

  const bindTxActions = () => {
    document.querySelectorAll('.tx-action-btn.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      });
    });

    document.querySelectorAll('.tx-action-btn.delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Удалить операцию?')) {
          await DB.delete(btn.dataset.id);
          transactions = transactions.filter(tx => tx.id !== btn.dataset.id);
          BotsRouter.resolve();
        }
      });
    });
  };

  const openEditModal = (txId) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;
    editingTxId = txId;
    els.modalTitle.textContent = 'Редактировать';
    document.getElementById('tx-name').value = tx.name || '';
    document.getElementById('tx-amount').value = tx.amount || tx.usdtValue || '';
    document.getElementById('tx-date').value = tx.date || '';
    document.getElementById('tx-notes').value = tx.notes || '';
    resetCustomSelect('[data-select="type"]', tx.type);
    resetCustomSelect('[data-select="currency"]', tx.currency || 'USDT');
    updateFormUI(tx.type);
    els.modal.showModal();
  };

  const exportData = () => {
    const botTxs = transactions.filter(tx => ['earning_invest', 'earning_payout'].includes(tx.type));
    const data = JSON.stringify(botTxs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptovibe-bots-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === ИСПРАВЛЕНО: используем результат от DB.add() и DB.update() ===
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const type = formData.get('type');
    const name = formData.get('name') || 'Не указано';
    const amount = parseFloat(formData.get('amount')) || 0;
    const currency = formData.get('currency') || 'USDT';
    const date = formData.get('date') || new Date().toISOString().split('T')[0];
    const notes = formData.get('notes') || '';
    
    if (amount <= 0) return alert('Укажите сумму');

    const txData = {
      id: editingTxId || crypto.randomUUID(),
      type,
      name,
      amount,
      currency,
      usdtValue: currency === 'USDT' ? amount : 0,
      date,
      notes
    };

    if (editingTxId) {
      const result = await DB.update(txData);
      const idx = transactions.findIndex(t => t.id === editingTxId);
      if (idx !== -1) transactions[idx] = result || txData;
    } else {
      const result = await DB.add(txData);
      transactions.push(result || txData);
    }
    
    els.modal.close();
    BotsRouter.resolve();
  });

  els.exportBtn?.addEventListener('click', exportData);

  const init = async () => {
    try {
      if (typeof FirebaseClient !== 'undefined') {
        await FirebaseClient.init();
        await new Promise(resolve => FirebaseClient.onAuthReady(() => resolve()));
        
        if (!FirebaseClient.isAuthenticated()) {
          const isGuest = localStorage.getItem('guest_mode') === 'true';
          if (!isGuest) {
            window.location.href = 'auth.html';
            return;
          }
        }
      }

      transactions = await DB.getAll();
      initCustomSelects();
      initNameAutocomplete();
      updateFormUI('earning_invest');
      BotsRouter.init();
    } catch (err) {
      console.error('Init error:', err);
      alert('Ошибка инициализации: ' + err.message);
    }
  };
  
  init();
});
