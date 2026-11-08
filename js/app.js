document.addEventListener('DOMContentLoaded', () => {
  const els = {
    main: document.getElementById('main-content'),
    modal: document.getElementById('tx-modal'),
    openBtn: document.getElementById('open-modal-btn'),
    closeBtn: document.getElementById('close-modal-btn'),
    form: document.getElementById('tx-form'),
    modalTitle: document.getElementById('modal-title'),
    exportBtn: document.getElementById('export-btn'),
    quantityInput: document.getElementById('tx-quantity'),
    usdtInput: document.getElementById('tx-usdt'),
    dateInput: document.getElementById('tx-date'),
    timeInput: document.getElementById('tx-time'),
    nameInput: document.getElementById('tx-name'),
    hintQuantity: document.getElementById('hint-quantity'),
    hintUsdt: document.getElementById('hint-usdt'),
    tokenFields: document.getElementById('token-fields'),
    financeFields: document.getElementById('finance-fields'),
    earningBotFields: document.getElementById('earning-bot-fields'),
    earningBotAmountInput: document.getElementById('tx-earning-bot-amount'),
    hintEarningBotAmount: document.getElementById('hint-earning-bot-amount')
  };
  let transactions = [];
  let operationTypes = [];
  let currentPeriod = 'all';
  let currentTokenPeriod = 'all';
  let editingTxId = null;
  const defaultTypes = [
    { key: 'buy', label: 'Покупка токена', category: 'trade', default: true },
    { key: 'sell', label: 'Продажа токена', category: 'trade', default: true },
    { key: 'swap', label: 'Обмен токена', category: 'trade', default: true },
    { key: 'bot_token_payout', label: 'Выплата токенов из бота', category: 'trade', default: true },
    { key: 'earning_invest', label: 'Пополнение бота для заработка', category: 'earning_bot', default: true },
    { key: 'earning_payout', label: 'Выплата из бота для заработка', category: 'earning_bot', default: true },
    { key: 'deposit', label: 'Пополнение', category: 'finance', default: true },
    { key: 'ad_expense', label: 'Реклама', category: 'finance', default: true }
  ];
  const formatMoney = (n) => {
    const val = parseFloat(n) || 0;
    const sign = val >= 0 ? '+' : '-';
    return sign + '$' + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const formatMoneyPlain = (n) => '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPrice = (price) => {
    if (!price || price === 0) return '$0.000000';
    return '$' + price.toFixed(6);
  };
  const formatGram = (n) => {
    const val = parseFloat(n) || 0;
    const sign = val >= 0 ? '+' : '-';
    return sign + Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' GRAM';
  };
  const formatInvested = (aggregated) => {
    const parts = [];
    if (aggregated.invested > 0) {
      parts.push(formatMoneyPlain(aggregated.invested));
    }
    for (const [currency, amount] of Object.entries(aggregated.investedCurrencies || {})) {
      if (amount > 0) {
        parts.push(parseFloat(amount).toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' ' + currency);
      }
    }
    return parts.length > 0 ? parts.join(' + ') : '$0.00';
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
  const filterByPeriod = (txs, period = currentPeriod) => {
    const cutoff = getPeriodFilter(period);
    if (!cutoff) return txs;
    return txs.filter(tx => {
      const txDate = new Date(tx.date + 'T' + (tx.time || '00:00'));
      return txDate >= cutoff;
    });
  };
  const getTypeLabel = (key) => {
    const type = operationTypes.find(t => t.key === key);
    return type ? type.label : key;
  };
  const getUniqueTokenNames = async () => {
    const names = new Set();
    if (typeof TokensRegistry !== 'undefined') {
      try {
        const stonTokens = await TokensRegistry.getAll();
        stonTokens.forEach(t => {
          if (t.name) names.add(t.name.toUpperCase());
        });
      } catch (e) {
        console.warn('Не удалось загрузить токены STON.fi:', e);
      }
    }
    transactions.forEach(tx => {
      if (tx.name && tx.name !== 'Не указано') {
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
    suggestionsList.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-secondary); border: var(--glass-border); border-radius: 8px; max-height: 250px; overflow-y: auto; z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,0.4); display: none;';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(suggestionsList);
    let stonTokensCache = [];
    let operationTokensCache = [];
    let dataLoaded = false;
    const loadStonTokens = async () => {
      if (typeof TokensRegistry === 'undefined') return;
      try {
        stonTokensCache = await TokensRegistry.getAll();
      } catch (e) {
        console.warn('Не удалось загрузить токены STON.fi:', e);
      }
    };
    const loadOperationTokens = () => {
      const names = new Set();
      transactions.forEach(tx => {
        if (tx.name && tx.name !== 'Не указано') {
          names.add(tx.name.toUpperCase());
        }
      });
      operationTokensCache = Array.from(names).sort();
    };
    const ensureDataLoaded = async () => {
      if (!dataLoaded) {
        await loadStonTokens();
        loadOperationTokens();
        dataLoaded = true;
      }
    };
    const renderSuggestions = async () => {
      const value = input.value.toUpperCase().trim();
      if (value.length < 1) {
        suggestionsList.style.display = 'none';
        return;
      }
      await ensureDataLoaded();
      const stonMatches = stonTokensCache
        .filter(t => t.name.toUpperCase().includes(value))
        .map(t => ({ name: t.name.toUpperCase(), fromSton: true }));
      const stonNames = new Set(stonMatches.map(t => t.name));
      const opMatches = operationTokensCache
        .filter(name => name.includes(value) && !stonNames.has(name))
        .map(name => ({ name, fromSton: false }));
      const allMatches = [...stonMatches, ...opMatches];
      if (allMatches.length === 0) {
        suggestionsList.style.display = 'none';
        return;
      }
      suggestionsList.innerHTML = allMatches.slice(0, 10).map(item => {
        const isExact = item.name === value;
        const badge = item.fromSton 
          ? '<span style="font-size:0.65rem; background: rgba(0, 255, 157, 0.15); color: var(--neon-green); padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.5rem;">STON</span>'
          : '';
        return '<div class="autocomplete-item" data-name="' + item.name + '" style="padding: 0.75rem; cursor: pointer; transition: background 0.15s; font-size: 0.95rem; display: flex; align-items: center; ' + (isExact ? 'background: rgba(0, 243, 255, 0.05);' : '') + '"><span style="flex: 1;">' + item.name + badge + '</span>' + (isExact ? '<span style="font-size:0.7rem; color:var(--neon-cyan);">(текущее)</span>' : '') + '</div>';
      }).join('');
      suggestionsList.style.display = 'block';
      suggestionsList.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(0, 243, 255, 0.15)';
          item.style.color = 'var(--neon-cyan)';
        });
        item.addEventListener('mouseleave', () => {
          const isExact = item.dataset.name === value;
          item.style.background = isExact ? 'rgba(0, 243, 255, 0.05)' : '';
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
  const renderTypeOptions = () => {
    const typeSelect = document.querySelector('[data-select="type"]');
    if (!typeSelect) return;
    const list = typeSelect.querySelector('.custom-select-list');
    if (!list) return;
    list.innerHTML = operationTypes.map(t => '<div class="custom-select-option" data-value="' + t.key + '"><span>' + t.label + '</span>' + (!t.default ? '<button type="button" class="delete-type-btn" data-key="' + t.key + '">&times;</button>' : '') + '</div>').join('');
    list.querySelectorAll('.delete-type-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        if (confirm('Удалить тип "' + getTypeLabel(key) + '"?')) {
          await DB.deleteType(key);
          operationTypes = operationTypes.filter(t => t.key !== key);
          renderTypeOptions();
        }
      });
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
        if (option && !e.target.classList.contains('delete-type-btn')) {
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
    const isToken = ['buy', 'sell', 'swap'].includes(type);
    const isBotTokenPayout = type === 'bot_token_payout';
    const isEarningBot = ['earning_invest', 'earning_payout'].includes(type);
    const isFinance = ['deposit', 'ad_expense'].includes(type);
    if (els.tokenFields) els.tokenFields.style.display = 'none';
    if (els.financeFields) els.financeFields.style.display = 'none';
    if (els.earningBotFields) els.earningBotFields.style.display = 'none';
    if (isToken) {
      if (els.tokenFields) els.tokenFields.style.display = 'grid';
      if (els.hintQuantity) els.hintQuantity.textContent = 'Сколько токенов';
      if (els.hintUsdt) els.hintUsdt.textContent = 'Сумма в USDT';
      if (els.usdtInput) {
        els.usdtInput.readOnly = false;
        els.usdtInput.style.opacity = '1';
      }
    } else if (isBotTokenPayout) {
      if (els.tokenFields) els.tokenFields.style.display = 'grid';
      if (els.hintQuantity) els.hintQuantity.textContent = 'Сколько токенов получили';
      if (els.hintUsdt) els.hintUsdt.textContent = 'Не требуется — токены бесплатные';
      if (els.usdtInput) {
        els.usdtInput.value = '0';
        els.usdtInput.readOnly = true;
        els.usdtInput.style.opacity = '0.5';
      }
    } else if (isEarningBot) {
      if (els.earningBotFields) els.earningBotFields.style.display = 'grid';
      const hint = els.hintEarningBotAmount;
      if (hint) hint.textContent = type === 'earning_invest' ? 'Сколько пополнили' : 'Сколько получили';
    } else if (isFinance) {
      if (els.financeFields) els.financeFields.style.display = 'block';
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
      if (els.timeInput) {
        const now = new Date();
        els.timeInput.value = now.toTimeString().slice(0, 5);
      }
      renderTypeOptions();
      resetCustomSelect('[data-select="type"]', 'buy');
      resetCustomSelect('[data-select="earningBotCurrency"]', 'USDT');
      updateFormUI('buy');
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
  const calculateOpenPositions = (txs) => {
    const openBuys = [];
    let totalOpenQty = 0;
    let totalOpenInvested = 0;
    const sorted = [...txs].sort((a, b) => {
      const dateA = new Date((a.date || '') + 'T' + (a.time || '00:00'));
      const dateB = new Date((b.date || '') + 'T' + (b.time || '00:00'));
      if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    console.log('=== FIFO расчёт ===');
    sorted.forEach(tx => {
      console.log(tx.date + ' ' + (tx.time || '00:00') + ' ' + tx.type + ' ' + tx.quantity);
    });
    sorted.forEach(tx => {
      if (tx.type === 'buy') {
        const qty = parseFloat(tx.quantity) || 0;
        const usdt = parseFloat(tx.usdtValue) || 0;
        const price = qty > 0 ? usdt / qty : 0;
        openBuys.push({
          qty,
          price,
          total: usdt,
          txId: tx.id,
          date: tx.date,
          time: tx.time || '00:00',
          remaining: qty
        });
        totalOpenQty += qty;
        totalOpenInvested += usdt;
      } else if (tx.type === 'sell' || tx.type === 'swap') {
        const sellQty = parseFloat(tx.quantity) || 0;
        let remainingToSell = sellQty;
        while (remainingToSell > 0 && openBuys.length > 0) {
          const buy = openBuys[0];
          const closeQty = Math.min(buy.remaining, remainingToSell);
          buy.remaining -= closeQty;
          totalOpenQty -= closeQty;
          totalOpenInvested -= closeQty * buy.price;
          remainingToSell -= closeQty;
          if (buy.remaining <= 0.0001) {
            openBuys.shift();
          }
        }
      }
    });
    console.log('Открытые позиции:', openBuys.length, 'штук');
    return {
      openBuys: openBuys.filter(b => b.remaining > 0.0001),
      totalOpenQty,
      totalOpenInvested,
      avgOpenPrice: totalOpenQty > 0 ? totalOpenInvested / totalOpenQty : 0
    };
  };
  const aggregateTokens = (txs) => {
    const tokens = {};
    txs.forEach(tx => {
      if (!['buy', 'sell', 'swap', 'bot_token_payout'].includes(tx.type)) return;
      const name = (tx.name || 'Неизвестно').toUpperCase();
      if (!tokens[name]) {
        tokens[name] = { 
          name, quantity: 0, invested: 0, profit: 0,
          investedCurrencies: {}, returnedCurrencies: {},
          buyCount: 0, sellCount: 0,
          totalBought: 0, totalSold: 0,
          totalBoughtQty: 0,
          botPayoutQty: 0,
          botPayoutCount: 0,
          buyHistory: [],
          operations: []
        };
      }
      const t = tokens[name];
      t.operations.push(tx);
      const qty = parseFloat(tx.quantity) || 0;
      const usdt = parseFloat(tx.usdtValue) || 0;
      if (tx.type === 'buy') {
        t.quantity += qty;
        t.buyCount++;
        t.totalBoughtQty += qty;
        if (qty > 0 && usdt > 0) {
          t.buyHistory.push({
            date: tx.date,
            quantity: qty,
            price: usdt / qty,
            total: usdt
          });
        }
      } else if (tx.type === 'bot_token_payout') {
        t.quantity += qty;
        t.totalBoughtQty += qty;
        t.botPayoutQty = (t.botPayoutQty || 0) + qty;
        t.botPayoutCount = (t.botPayoutCount || 0) + 1;
      } else if (tx.type === 'sell' || tx.type === 'swap') {
        t.quantity -= qty;
        t.sellCount++;
      }
    });
    return Object.values(tokens).map(t => {
      let totalBought = 0;
      let totalSold = 0;
      t.operations.forEach(op => {
        const opUsdt = parseFloat(op.usdtValue) || 0;
        if (op.type === 'buy') {
          totalBought += opUsdt;
        } else if (op.type === 'sell' || op.type === 'swap') {
          totalSold += opUsdt;
        }
      });
      t.profit = totalSold - totalBought;
      t.invested = totalBought - totalSold;
      if (t.invested < 0) t.invested = 0;
      t.totalBought = totalBought;
      t.totalSold = totalSold;
      t.avgBuyPrice = t.totalBoughtQty > 0 ? t.totalBought / t.totalBoughtQty : 0;
      t.buyHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
      t.lastBuys = t.buyHistory.slice(0, 3);
      const openPositions = calculateOpenPositions(t.operations);
      t.openPositions = openPositions;
      t.category = 'token';
      return t;
    });
  };
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
      b.profitUSDT = b.returnedUSDT - b.investedUSDT;
      b.profitGRAM = b.returnedGRAM - b.investedGRAM;
      return b;
    });
  };
  const calculateStats = (txs) => {
    let tokenBought = 0, tokenSold = 0;
    txs.filter(tx => ['buy', 'sell', 'swap'].includes(tx.type)).forEach(tx => {
      const usdt = parseFloat(tx.usdtValue) || 0;
      if (tx.type === 'buy') tokenBought += usdt;
      else if (tx.type === 'sell' || tx.type === 'swap') tokenSold += usdt;
    });
    const tokenProfit = tokenSold - tokenBought;
    let botInvestedUSDT = 0, botReturnedUSDT = 0;
    let botInvestedGRAM = 0, botReturnedGRAM = 0;
    txs.filter(tx => ['earning_invest', 'earning_payout'].includes(tx.type)).forEach(tx => {
      const amount = parseFloat(tx.amount || tx.usdtValue) || 0;
      const currency = (tx.currency || 'USDT').toUpperCase();
      if (tx.type === 'earning_invest') {
        if (currency === 'GRAM') botInvestedGRAM += amount;
        else botInvestedUSDT += amount;
      } else if (tx.type === 'earning_payout') {
        if (currency === 'GRAM') botReturnedGRAM += amount;
        else botReturnedUSDT += amount;
      }
    });
    const botProfitUSDT = botReturnedUSDT - botInvestedUSDT;
    const botProfitGRAM = botReturnedGRAM - botInvestedGRAM;
    const totalProfitUSDT = tokenProfit + botProfitUSDT;
    return { 
      tokenProfit, 
      botProfitUSDT, 
      botProfitGRAM,
      totalProfitUSDT
    };
  };
  const calculatePeriodProfit = (txs, period) => {
    const filtered = filterByPeriod(txs, period);
    let totalSold = 0;
    let totalBought = 0;
    filtered.forEach(tx => {
      const usdt = parseFloat(tx.usdtValue) || 0;
      if (tx.type === 'sell' || tx.type === 'swap') {
        totalSold += usdt;
      } else if (tx.type === 'buy') {
        totalBought += usdt;
      }
    });
    return totalSold - totalBought;
  };
  const getBadgeClass = (type) => {
    if (['buy', 'sell', 'swap'].includes(type)) return 'badge-trade';
    if (type === 'bot_token_payout') return 'badge-bot-payout';
    if (type === 'ad_expense') return 'badge-ad';
    if (type === 'deposit') return 'badge-deposit';
    if (type === 'earning_invest') return 'badge-earning';
    if (type === 'earning_payout') return 'badge-earning';
    return 'badge-custom';
  };
  const renderTxItem = (tx, openBuyIds = new Set()) => {
    const isEarningBot = ['earning_invest', 'earning_payout'].includes(tx.type);
    const isFinance = ['deposit', 'ad_expense'].includes(tx.type);
    const isToken = ['buy', 'sell', 'swap'].includes(tx.type);
    const isBotTokenPayout = tx.type === 'bot_token_payout';
    let usdt = 0;
    let displayText = '';
    let isPositive = false;
    let isNegative = false;
    if (isBotTokenPayout) {
      const qty = parseFloat(tx.quantity) || 0;
      displayText = qty.toLocaleString('en-US') + ' ' + (tx.name || '') + ' токенов';
      isPositive = true;
    } else if (isEarningBot) {
      usdt = parseFloat(tx.amount || tx.usdtValue) || 0;
      const currency = (tx.currency || 'USDT').toUpperCase();
      displayText = usdt.toLocaleString('en-US') + ' ' + currency;
      isPositive = tx.type === 'earning_payout';
      isNegative = tx.type === 'earning_invest';
    } else if (isFinance) {
      usdt = parseFloat(tx.usdtValue) || 0;
      displayText = '$' + usdt.toFixed(2);
      isPositive = tx.type === 'deposit';
      isNegative = tx.type === 'ad_expense';
    } else if (isToken) {
      usdt = parseFloat(tx.usdtValue) || 0;
      const qty = parseFloat(tx.quantity) || 0;
      const price = qty > 0 && usdt > 0 ? (usdt / qty) : 0;
      const qtyText = qty ? qty.toLocaleString('en-US') + ' ' + (tx.name || '') : '';
      const priceText = price > 0 ? ' @ ' + formatPrice(price) : '';
      displayText = qtyText + priceText;
      isPositive = tx.type === 'sell';
      isNegative = tx.type === 'buy';
    }
    const typeLabel = getTypeLabel(tx.type);
    const amountDisplay = isBotTokenPayout 
      ? '+' + parseFloat(tx.quantity || 0).toLocaleString('en-US') + ' шт'
      : (isPositive ? '+' : (isNegative ? '-' : '')) + '$' + usdt.toFixed(2);
    let statusBadge = '';
    if (tx.type === 'buy') {
      if (openBuyIds.has(tx.id)) {
        statusBadge = '<span class="tx-status open">⚠️ Открыто</span>';
      } else {
        statusBadge = '<span class="tx-status closed">✅ Закрыто</span>';
      }
    }
    let currentPriceInfo = '';
    if (tx.type === 'buy' && openBuyIds.has(tx.id)) {
      const tokenName = (tx.name || '').toUpperCase();
      const currentPrice = window._currentPrices?.[tokenName] || 0;
      if (currentPrice > 0) {
        const buyPrice = parseFloat(tx.usdtValue) / parseFloat(tx.quantity);
        const diff = currentPrice - buyPrice;
        const diffPercent = buyPrice > 0 ? (diff / buyPrice * 100) : 0;
        const diffColor = diff >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
        const diffSign = diff >= 0 ? '+' : '';
        currentPriceInfo = '<div class="tx-current-price" style="font-size: 0.75rem; color: var(--neon-cyan); margin-top: 0.25rem;">Текущий курс: $' + currentPrice.toFixed(8) + ' (' + diffSign + diffPercent.toFixed(1) + '%)</div>';
      }
    }
    const timeDisplay = tx.time ? ' ' + tx.time : '';
    return '<article class="tx-item ' + (tx.type === 'buy' && openBuyIds.has(tx.id) ? 'tx-open' : '') + '"><div class="tx-info"><h4><span class="tx-badge ' + getBadgeClass(tx.type) + '">' + typeLabel + '</span> ' + (tx.name || 'Без названия') + ' ' + statusBadge + '</h4><div class="tx-meta">' + tx.date + timeDisplay + ' • ' + displayText + '</div>' + currentPriceInfo + '</div><div class="tx-amount ' + (isPositive ? 'pos' : (isNegative ? 'neg' : 'neutral')) + '">' + amountDisplay + '</div><div class="tx-actions"><button class="tx-action-btn edit" data-id="' + tx.id + '">✏️</button><button class="tx-action-btn delete" data-id="' + tx.id + '">🗑️</button></div></article>';
  };
  const renderPeriodFilter = () => '<div class="period-filter"> <button class="period-btn ' + (currentPeriod === 'week' ? 'active' : '') + '" data-period="week">7 дней</button> <button class="period-btn ' + (currentPeriod === 'month' ? 'active' : '') + '" data-period="month">30 дней</button> <button class="period-btn ' + (currentPeriod === 'year' ? 'active' : '') + '" data-period="year">Год</button> <button class="period-btn ' + (currentPeriod === 'all' ? 'active' : '') + '" data-period="all">Всё время</button> </div>';
  const renderTokenPeriodFilter = () => '<div class="period-filter"> <button class="period-btn ' + (currentTokenPeriod === 'week' ? 'active' : '') + '" data-token-period="week">7 дней</button> <button class="period-btn ' + (currentTokenPeriod === 'month' ? 'active' : '') + '" data-token-period="month">30 дней</button> <button class="period-btn ' + (currentTokenPeriod === 'year' ? 'active' : '') + '" data-token-period="year">Год</button> <button class="period-btn ' + (currentTokenPeriod === 'all' ? 'active' : '') + '" data-token-period="all">Всё время</button> </div>';
  const calculateTokenPeriodStats = (txs, period) => {
    const filtered = filterByPeriod(txs, period);
    const allAssets = aggregateTokens(filtered);
    const totalTokens = allAssets.length;
    const totalInvested = allAssets.reduce((sum, t) => sum + t.invested, 0);
    const totalProfit = allAssets.reduce((sum, t) => sum + t.profit, 0);
    const totalQuantity = allAssets.reduce((sum, t) => sum + t.quantity, 0);
    const totalSold = allAssets.reduce((sum, t) => sum + t.totalSold, 0);
    return { totalTokens, totalInvested, totalProfit, totalQuantity, totalSold };
  };
  const renderPortfolioView = () => {
    const filtered = filterByPeriod(transactions);
    const stats = calculateStats(filtered);
    const allAssets = aggregateTokens(filtered);
    const tokens = allAssets.filter(t => t.quantity > 0);
    let totalUnrealizedInvested = 0;
    let totalUnrealizedQty = 0;
    tokens.forEach(t => {
      if (t.openPositions && t.openPositions.totalOpenQty > 0) {
        totalUnrealizedInvested += t.openPositions.totalOpenInvested;
        totalUnrealizedQty += t.openPositions.totalOpenQty;
      }
    });
    let totalPotentialProfit = 0;
    tokens.forEach(t => {
      if (t.openPositions && t.openPositions.totalOpenQty > 0) {
        const currentPrice = window._currentPrices?.[t.name] || 0;
        if (currentPrice > 0) {
          const potentialValue = t.openPositions.totalOpenQty * currentPrice;
          totalPotentialProfit += potentialValue - t.openPositions.totalOpenInvested;
        }
      }
    });
    return '<header class="page-header"><h1>Мой портфель</h1><p>Обзор всех активов и операций</p></header>' + renderPeriodFilter() + '<section class="stats-grid"><article class="stat-card"><h3>Прибыль (Токены USDT)</h3><p class="metric-value ' + (stats.tokenProfit >= 0 ? 'positive' : 'negative') + '">' + formatMoney(stats.tokenProfit) + '</p></article><article class="stat-card"><h3>Прибыль (Боты USDT)</h3><p class="metric-value ' + (stats.botProfitUSDT >= 0 ? 'positive' : 'negative') + '">' + formatMoney(stats.botProfitUSDT) + '</p></article><article class="stat-card"><h3>Прибыль (Боты GRAM)</h3><p class="metric-value ' + (stats.botProfitGRAM >= 0 ? 'positive' : 'negative') + '">' + formatGram(stats.botProfitGRAM) + '</p></article><article class="stat-card"><h3>Общая прибыль (USDT)</h3><p class="metric-value ' + (stats.totalProfitUSDT >= 0 ? 'positive' : 'negative') + '">' + formatMoney(stats.totalProfitUSDT) + '</p></article>' + (totalUnrealizedQty > 0 ? '<article class="stat-card" style="border-color: rgba(255, 230, 0, 0.3);"><h3>Открытые позиции</h3><p class="metric-value" style="color: var(--neon-yellow);">' + formatMoneyPlain(totalUnrealizedInvested) + '</p><span class="metric-sub">' + totalUnrealizedQty.toLocaleString('en-US') + ' токенов</span></article><article class="stat-card" style="border-color: rgba(0, 243, 255, 0.3);"><h3>Незафиксированная прибыль</h3><p class="metric-value ' + (totalPotentialProfit >= 0 ? 'positive' : 'negative') + '">' + formatMoney(totalPotentialProfit) + '</p><span class="metric-sub">при продаже по текущему курсу</span></article>' : '') + '</section><section class="section"><div class="section-header"><h2>Купленные токены</h2></div><div class="token-list">' + (tokens.length > 0 ? tokens.map(t => {
      const currentPrice = window._currentPrices?.[t.name] || null;
      const avgPrice = t.avgBuyPrice || 0;
      let currentPriceHtml = '';
      if (currentPrice && currentPrice > 0) {
        const change = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice * 100) : 0;
        const changeColor = change >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
        const changeSign = change >= 0 ? '+' : '';
        const changeArrow = change >= 0 ? '▲' : '▼';
        currentPriceHtml = '<div class="token-sub">Текущая цена: <span style="color: var(--neon-cyan); font-weight: 600;">$' + currentPrice.toFixed(8) + '</span><span style="color: ' + changeColor + '; margin-left: 0.5rem;">' + changeArrow + ' ' + changeSign + change.toFixed(2) + '%</span></div>';
      } else {
        currentPriceHtml = '<div class="token-sub">Текущая цена: <span style="color: var(--text-secondary);">Нет данных</span></div>';
      }
      let openPositionHtml = '';
      if (t.openPositions && t.openPositions.totalOpenQty > 0) {
        const openInvested = t.openPositions.totalOpenInvested;
        const openQty = t.openPositions.totalOpenQty;
        const potentialProfit = currentPrice && currentPrice > 0 ? (openQty * currentPrice) - openInvested : 0;
        const profitColor = potentialProfit >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
        const profitSign = potentialProfit >= 0 ? '+' : '';
        openPositionHtml = '<div class="token-sub" style="color: var(--neon-yellow); margin-top: 0.25rem;">⚠️ Открыто: ' + openQty.toLocaleString('en-US') + ' шт (' + formatMoneyPlain(openInvested) + ')' + (currentPrice && currentPrice > 0 ? ' | Потенциал: <span style="color: ' + profitColor + ';">' + profitSign + formatMoney(potentialProfit) + '</span>' : '') + '</div>';
      }
      return '<a href="#/token/' + encodeURIComponent(t.name) + '" class="token-item"><div class="token-info"><div class="token-icon">' + t.name.substring(0, 2) + '</div><div><div class="token-name">' + t.name + '</div><div class="token-sub">Количество: ' + parseFloat(t.quantity).toLocaleString('en-US') + '</div><div class="token-sub">Цена покупки: ' + formatPrice(avgPrice) + '</div>' + openPositionHtml + currentPriceHtml + '</div></div><div class="token-stats"><div class="token-value" style="color: ' + (t.invested > 0 ? 'var(--neon-red)' : 'var(--text-primary)') + ';">' + formatMoneyPlain(t.invested) + '</div></div></a>';
    }).join('') : '<div class="empty-state">Нет купленных токенов</div>') + '</div></section>';
  };
  const renderTokensView = (searchQuery = '') => {
    const filteredTxs = filterByPeriod(transactions, currentTokenPeriod);
    const allAssets = aggregateTokens(filteredTxs);
    const filtered = searchQuery ? allAssets.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())) : allAssets;
    const stats = calculateTokenPeriodStats(transactions, currentTokenPeriod);
    return '<header class="page-header"><h1>Все токены</h1><p>Нажмите для подробной статистики</p></header>' + renderTokenPeriodFilter() + '<section class="stats-grid"><article class="stat-card"><h3>Всего токенов</h3><p class="metric-value">' + stats.totalTokens + '</p></article><article class="stat-card"><h3>Вложено (остаток)</h3><p class="metric-value" style="color: ' + (stats.totalInvested > 0 ? 'var(--neon-red)' : 'var(--text-primary)') + ';">' + formatMoneyPlain(stats.totalInvested) + '</p></article><article class="stat-card"><h3>Общая прибыль</h3><p class="metric-value ' + (stats.totalProfit >= 0 ? 'positive' : 'negative') + '">' + formatMoney(stats.totalProfit) + '</p></article><article class="stat-card"><h3>Всего продано</h3><p class="metric-value positive">' + formatMoneyPlain(stats.totalSold) + '</p></article></section><div class="search-box"><input type="search" id="token-search" placeholder="Поиск..." value="' + searchQuery + '"></div><div class="token-list">' + (filtered.length > 0 ? filtered.map(t => '<a href="#/token/' + encodeURIComponent(t.name) + '" class="token-item"><div class="token-info"><div class="token-icon">' + t.name.substring(0, 2) + '</div><div><div class="token-name">' + t.name + '</div><div class="token-sub">Кол-во: ' + parseFloat(t.quantity).toLocaleString('en-US') + '</div></div></div><div class="token-stats"><div class="token-value" style="color: ' + (t.invested > 0 ? 'var(--neon-red)' : 'var(--text-primary)') + ';">' + formatMoneyPlain(t.invested) + '</div><div class="token-profit ' + (t.profit >= 0 ? 'pos' : 'neg') + '">' + formatMoney(t.profit) + '</div></div></a>').join('') : '<div class="empty-state">Токены не найдены</div>') + '</div>';
  };
  const renderTokenDetailView = (tokenName) => {
    const name = decodeURIComponent(tokenName).toUpperCase();
    const tokenTxs = transactions.filter(tx => (tx.name || '').toUpperCase() === name && ['buy', 'sell', 'swap', 'bot_token_payout'].includes(tx.type));
    if (tokenTxs.length === 0) {
      return '<button class="back-btn" onclick="history.back()">← Назад</button><div class="empty-state">Токен не найден</div>';
    }
    const aggregated = aggregateTokens(tokenTxs)[0];
    const investedDisplay = formatInvested(aggregated);
    const profitWeek = calculatePeriodProfit(tokenTxs, 'week');
    const profitMonth = calculatePeriodProfit(tokenTxs, 'month');
    const profitYear = calculatePeriodProfit(tokenTxs, 'year');
    const lastBuysHtml = aggregated.lastBuys && aggregated.lastBuys.length > 0 
      ? aggregated.lastBuys.map((buy) => '<div style="display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid var(--glass-border); font-size: 0.85rem;"><span style="color: var(--text-secondary);">' + buy.date + '</span><span>' + formatPrice(buy.price) + '</span><span style="color: var(--text-secondary);">' + parseFloat(buy.quantity).toLocaleString('en-US') + '</span></div>').join('')
      : '<div style="color: var(--text-secondary); font-size: 0.85rem; padding: 0.5rem 0;">Нет покупок</div>';
    const botPayoutHtml = aggregated.botPayoutQty > 0 ? '<div class="detail-card" style="border-color: rgba(0, 255, 157, 0.3);"><label>Выведено из ботов</label><div class="value" style="color: var(--neon-green);">' + parseFloat(aggregated.botPayoutQty).toLocaleString('en-US') + '</div><div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">' + (aggregated.botPayoutCount || 0) + ' выплат</div></div>' : '';
    const openPositions = aggregated.openPositions || { openBuys: [], totalOpenQty: 0, totalOpenInvested: 0, avgOpenPrice: 0 };
    const currentPrice = window._currentPrices?.[name] || 0;
    const currentPriceCardHtml = '<div class="detail-card" style="border-color: ' + (currentPrice > 0 ? 'rgba(0, 243, 255, 0.3)' : 'var(--glass-border)') + ';"><label>Текущий курс</label>' + (currentPrice > 0 ? '<div class="value" style="color: var(--neon-cyan);">$' + currentPrice.toFixed(8) + '</div>' + (aggregated.avgBuyPrice > 0 ? (() => {
      const change = ((currentPrice - aggregated.avgBuyPrice) / aggregated.avgBuyPrice * 100);
      const changeColor = change >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
      const changeSign = change >= 0 ? '+' : '';
      const changeArrow = change >= 0 ? '▲' : '▼';
      return '<div style="font-size: 0.8rem; color: ' + changeColor + '; margin-top: 0.25rem;">' + changeArrow + ' ' + changeSign + change.toFixed(2) + '% от средней</div>';
    })() : '') : '<div class="value" style="color: var(--text-secondary); font-size: 1rem;">Нет данных</div>') + '</div>';
    let openPositionsHtml = '';
    if (openPositions.totalOpenQty > 0) {
      openPositionsHtml = '<div class="detail-card open-positions-card"><label style="color: var(--neon-yellow); font-weight: 600;">📊 Открытые позиции</label><div style="margin-top: 0.75rem;"><div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span style="color: var(--text-secondary); font-size: 0.85rem;">Количество:</span><span style="font-weight: 600;">' + parseFloat(openPositions.totalOpenQty).toLocaleString('en-US') + ' ' + name + '</span></div><div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;"><span style="color: var(--text-secondary); font-size: 0.85rem;">Вложено:</span><span style="font-weight: 600; color: var(--neon-red);">' + formatMoneyPlain(openPositions.totalOpenInvested) + '</span></div></div></div>';
    }
    const openBuyIds = new Set(openPositions.openBuys.map(b => b.txId));
    return '<button class="back-btn" onclick="history.back()">← Назад</button><div class="token-detail-header"><div class="token-icon">' + name.substring(0, 2) + '</div><div><h1>' + name + '</h1><p style="color: var(--text-secondary);">Токен • ' + aggregated.operations.length + ' операций</p></div></div><section class="detail-grid"><div class="detail-card"><label>Вложено (остаток)</label><div class="value" style="color: ' + (aggregated.invested > 0 ? 'var(--neon-cyan)' : 'var(--text-primary)') + ';">' + formatMoneyPlain(aggregated.invested) + '</div></div><div class="detail-card"><label>Прибыль</label><div class="value ' + (aggregated.profit >= 0 ? 'positive' : 'negative') + '">' + formatMoney(aggregated.profit) + '</div></div><div class="detail-card"><label>Последние покупки</label><div style="margin-top: 0.5rem;">' + lastBuysHtml + '</div></div><div class="detail-card"><label>Текущее кол-во</label><div class="value">' + parseFloat(aggregated.quantity).toLocaleString('en-US') + '</div></div>' + currentPriceCardHtml + botPayoutHtml + openPositionsHtml + '</section><section class="section"><div class="section-header"><h2>Чистая прибыль по периодам</h2></div><div class="detail-grid"><div class="detail-card"><label>За 7 дней</label><div class="value ' + (profitWeek >= 0 ? 'positive' : 'negative') + '">' + formatMoney(profitWeek) + '</div></div><div class="detail-card"><label>За 30 дней</label><div class="value ' + (profitMonth >= 0 ? 'positive' : 'negative') + '">' + formatMoney(profitMonth) + '</div></div><div class="detail-card"><label>За год</label><div class="value ' + (profitYear >= 0 ? 'positive' : 'negative') + '">' + formatMoney(profitYear) + '</div></div></div></section><section class="section"><div class="section-header"><h2>История операций</h2></div><div class="tx-list">' + aggregated.operations.sort((a, b) => {
      const dateA = new Date((b.date || '') + 'T' + (b.time || '00:00'));
      const dateB = new Date((a.date || '') + 'T' + (a.time || '00:00'));
      return dateA - dateB;
    }).map(tx => renderTxItem(tx, openBuyIds)).join('') + '</div></section>';
  };
  const renderTradingView = () => {
    const allAssets = aggregateTokens(transactions);
    return '<header class="page-header"><h1>Трейдинг</h1><p>Покупки, продажи и обмены</p></header><div class="token-list">' + (allAssets.length > 0 ? allAssets.map(t => '<a href="#/token/' + encodeURIComponent(t.name) + '" class="token-item"><div class="token-info"><div class="token-icon">' + t.name.substring(0, 2) + '</div><div><div class="token-name">' + t.name + '</div><div class="token-sub">' + t.buyCount + ' покупок • ' + t.sellCount + ' продаж</div></div></div><div class="token-stats"><div class="token-value" style="color: ' + (t.invested > 0 ? 'var(--neon-red)' : 'var(--text-primary)') + ';">' + formatMoneyPlain(t.invested) + '</div><div class="token-profit ' + (t.profit >= 0 ? 'pos' : 'neg') + '">' + formatMoney(t.profit) + '</div></div></a>').join('') : '<div class="empty-state">Нет сделок</div>') + '</div>';
  };
  const renderSettingsView = () => {
    const customTypes = operationTypes.filter(t => !t.default);
    const defaultTypesList = operationTypes.filter(t => t.default);
    return '<header class="page-header"><h1>Настройки</h1><p>Управление данными</p></header><section class="section"><div class="stat-card"><h2>Типы операций</h2><div class="add-type-form"><h3>Добавить новый тип</h3><div class="form-row"><div class="form-group"><label>Ключ (латиницей)</label><input type="text" id="new-type-key" class="form-input" placeholder="gift"></div><div class="form-group"><label>Название</label><input type="text" id="new-type-label" class="form-input" placeholder="Подарок"></div></div><button class="submit-btn" id="add-type-btn">Добавить</button></div><h3>Стандартные типы</h3><div class="type-list">' + defaultTypesList.map(t => '<div class="type-item"><div class="type-item-info"><span class="type-item-key">' + t.key + '</span><span>' + t.label + '</span></div><span style="font-size: 0.75rem; color: var(--text-secondary);">стандартный</span></div>').join('') + '</div>' + (customTypes.length > 0 ? '<h3>Мои типы</h3><div class="type-list">' + customTypes.map(t => '<div class="type-item"><div class="type-item-info"><span class="type-item-key">' + t.key + '</span><span>' + t.label + '</span></div><div class="type-item-actions"><button class="edit-type-btn" data-key="' + t.key + '">✏️</button><button class="danger delete-type-btn" data-key="' + t.key + '">🗑️</button></div></div>').join('') + '</div>' : '') + '</div></section><section class="section"><div class="stat-card"><h3>Экспорт данных</h3><button class="submit-btn" id="export-btn-inline">📦 Скачать JSON</button></div><div class="stat-card"><h3>Статистика</h3><p>Операций: <strong>' + transactions.length + '</strong></p><p>Типов: <strong>' + operationTypes.length + '</strong></p></div></section>';
  };
  Router.register('#/portfolio', async () => {
    await updateTokenPrices();
    els.main.innerHTML = renderPortfolioView();
    bindPeriodFilter();
    bindTxActions();
  });
  Router.register('#/tokens', () => {
    els.main.innerHTML = renderTokensView();
    bindTokenSearch();
    bindTokenPeriodFilter();
  });
  Router.register('#/token', (params) => {
    els.main.innerHTML = renderTokenDetailView(params[0] || '');
    bindTxActions();
  });
  Router.register('#/trading', () => {
    els.main.innerHTML = renderTradingView();
  });
  Router.register('#/settings', () => {
    els.main.innerHTML = renderSettingsView();
    document.getElementById('export-btn-inline')?.addEventListener('click', exportData);
    bindSettingsActions();
  });
  Router.register('#/ston-tokens', async () => {
    await updateTokenPrices();
    els.main.innerHTML = await StonPage.render();
    StonPage.bindEvents();
  });
  const bindPeriodFilter = () => {
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPeriod = btn.dataset.period;
        els.main.innerHTML = renderPortfolioView();
        bindPeriodFilter();
        bindTxActions();
      });
    });
  };
  const bindTokenPeriodFilter = () => {
    document.querySelectorAll('[data-token-period]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTokenPeriod = btn.dataset.tokenPeriod;
        const searchInput = document.getElementById('token-search');
        const searchQuery = searchInput ? searchInput.value : '';
        els.main.innerHTML = renderTokensView(searchQuery);
        bindTokenSearch();
        bindTokenPeriodFilter();
      });
    });
  };
  const bindTokenSearch = () => {
    const input = document.getElementById('token-search');
    if (!input) return;
    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        els.main.innerHTML = renderTokensView(e.target.value);
        bindTokenSearch();
        bindTokenPeriodFilter();
        const newInput = document.getElementById('token-search');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(e.target.value.length, e.target.value.length);
        }
      }, 200);
    });
  };
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
          Router.resolve();
        }
      });
    });
  };
  const bindSettingsActions = () => {
    const addBtn = document.getElementById('add-type-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const key = document.getElementById('new-type-key').value.trim().toLowerCase();
        const label = document.getElementById('new-type-label').value.trim();
        if (!key || !label) return alert('Заполните поля');
        if (!/^[a-z0-9_]+$/.test(key)) return alert('Только латиница и цифры');
        if (operationTypes.find(t => t.key === key)) return alert('Уже существует');
        await DB.addType({ key, label, default: false });
        operationTypes.push({ key, label, default: false });
        els.main.innerHTML = renderSettingsView();
        bindSettingsActions();
        renderTypeOptions();
      });
    }
    document.querySelectorAll('.edit-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = operationTypes.find(t => t.key === btn.dataset.key);
        if (!type) return;
        const newLabel = prompt('Новое название:', type.label);
        if (newLabel && newLabel.trim()) {
          type.label = newLabel.trim();
          DB.addType(type).then(() => {
            els.main.innerHTML = renderSettingsView();
            bindSettingsActions();
            renderTypeOptions();
          });
        }
      });
    });
    document.querySelectorAll('.delete-type-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Удалить тип?')) {
          await DB.deleteType(btn.dataset.key);
          operationTypes = operationTypes.filter(t => t.key !== btn.dataset.key);
          els.main.innerHTML = renderSettingsView();
          bindSettingsActions();
          renderTypeOptions();
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
    document.getElementById('tx-date').value = tx.date || '';
    if (els.timeInput) els.timeInput.value = tx.time || '';
    document.getElementById('tx-notes').value = tx.notes || '';
    const isToken = ['buy', 'sell', 'swap'].includes(tx.type);
    const isBotTokenPayout = tx.type === 'bot_token_payout';
    const isEarningBot = ['earning_invest', 'earning_payout'].includes(tx.type);
    const isFinance = ['deposit', 'ad_expense'].includes(tx.type);
    if (isToken) {
      if (els.quantityInput) els.quantityInput.value = tx.quantity || '';
      if (els.usdtInput) {
        els.usdtInput.value = tx.usdtValue || '';
        els.usdtInput.readOnly = false;
        els.usdtInput.style.opacity = '1';
      }
    } else if (isBotTokenPayout) {
      if (els.quantityInput) els.quantityInput.value = tx.quantity || '';
      if (els.usdtInput) {
        els.usdtInput.value = '0';
        els.usdtInput.readOnly = true;
        els.usdtInput.style.opacity = '0.5';
      }
    } else if (isEarningBot) {
      if (els.earningBotAmountInput) els.earningBotAmountInput.value = tx.amount || tx.usdtValue || '';
      resetCustomSelect('[data-select="earningBotCurrency"]', tx.currency || 'USDT');
    } else if (isFinance) {
      const financeInput = document.getElementById('tx-finance-usdt');
      if (financeInput) financeInput.value = tx.usdtValue || '';
    }
    renderTypeOptions();
    resetCustomSelect('[data-select="type"]', tx.type);
    updateFormUI(tx.type);
    els.modal.showModal();
  };
  const exportData = () => {
    const data = JSON.stringify({ transactions, operationTypes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cryptovibe-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const type = formData.get('type');
    const name = formData.get('name') || 'Не указано';
    const date = formData.get('date') || new Date().toISOString().split('T')[0];
    const time = formData.get('time') || '';
    const notes = formData.get('notes') || '';
    let quantity = 0, usdtValue = 0, rate = 0;
    let botAmount = 0, botCurrency = 'USDT';
    const isToken = ['buy', 'sell', 'swap'].includes(type);
    const isBotTokenPayout = type === 'bot_token_payout';
    const isEarningBot = ['earning_invest', 'earning_payout'].includes(type);
    const isFinance = ['deposit', 'ad_expense'].includes(type);
    if (isToken) {
      quantity = parseFloat(formData.get('quantity')) || 0;
      usdtValue = parseFloat(formData.get('usdt')) || 0;
      if (quantity <= 0 || usdtValue <= 0) return alert('Укажите количество и сумму');
      rate = usdtValue / quantity;
    } else if (isBotTokenPayout) {
      quantity = parseFloat(formData.get('quantity')) || 0;
      usdtValue = 0;
      rate = 0;
      if (quantity <= 0) return alert('Укажите количество токенов');
    } else if (isEarningBot) {
      botAmount = parseFloat(formData.get('earningBotAmount')) || 0;
      botCurrency = formData.get('earningBotCurrency') || 'USDT';
      usdtValue = botCurrency === 'USDT' ? botAmount : 0;
      if (botAmount <= 0) return alert('Укажите сумму');
    } else if (isFinance) {
      usdtValue = parseFloat(formData.get('financeUsdt')) || 0;
      if (usdtValue <= 0) return alert('Укажите сумму');
    }
    const txData = {
      id: editingTxId || crypto.randomUUID(),
      type,
      name,
      quantity,
      usdtValue,
      rate,
      date,
      time,
      notes,
      amount: isEarningBot ? botAmount : null,
      currency: isEarningBot ? botCurrency : null,
      createdAt: Date.now()
    };
    if (editingTxId) {
      await DB.update(txData);
      const idx = transactions.findIndex(t => t.id === editingTxId);
      if (idx !== -1) transactions[idx] = txData;
    } else {
      await DB.add(txData);
      transactions.push(txData);
    }
    els.modal.close();
    Router.resolve();
  });
  els.exportBtn?.addEventListener('click', exportData);
  const updateTokenPrices = async () => {
    if (typeof TokensRegistry === 'undefined' || typeof StonAPI === 'undefined') return;
    try {
      const stonTokens = await TokensRegistry.getAll();
      if (stonTokens.length === 0) return;
      const addresses = stonTokens.map(t => t.address);
      const prices = await StonAPI.getMultiplePrices(addresses);
      window._stonPrices = prices;
      const currentPrices = {};
      stonTokens.forEach(token => {
        const priceData = prices[token.address];
        if (priceData && priceData.available && priceData.price > 0) {
          currentPrices[token.name.toUpperCase()] = priceData.price;
        }
      });
      window._currentPrices = currentPrices;
      console.log('Текущие цены:', currentPrices);
    } catch (err) {
      console.error('updateTokenPrices error:', err);
    }
  };
  const init = async () => {
    try {
      // Проверка авторизации Firebase
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
        
        // Миграция токенов
        if (FirebaseClient.isAuthenticated()) {
          console.log('🔄 Миграция токенов...');
          await FirebaseClient.migrateTokensFromLocalStorage();
        }
      }
      
      let storedTypes = await DB.getTypes();
      if (storedTypes.length === 0) {
        for (const t of defaultTypes) await DB.addType(t);
        storedTypes = defaultTypes;
      } else {
        const existingKeys = new Set(storedTypes.map(t => t.key));
        for (const t of defaultTypes) {
          if (!existingKeys.has(t.key)) {
            console.log('Добавляем недостающий тип:', t.label);
            await DB.addType(t);
            storedTypes.push(t);
          }
        }
      }
      operationTypes = storedTypes;
      console.log('Загруженные типы операций:', operationTypes.map(t => t.label));
      initCustomSelects();
      renderTypeOptions();
      initNameAutocomplete();
      updateFormUI('buy');
      transactions = await DB.getAll();
      let migrationNeeded = false;
      for (const tx of transactions) {
        let updated = false;
        if (!tx.time) {
          tx.time = '12:00';
          updated = true;
        }
        if (!tx.createdAt) {
          tx.createdAt = new Date(tx.date + 'T' + (tx.time || '12:00')).getTime();
          updated = true;
        }
        if (updated) {
          await DB.update(tx);
          migrationNeeded = true;
        }
      }
      if (migrationNeeded) {
        console.log('Миграция: добавлены time и createdAt для старых транзакций');
      }
      Router.init();
      if (typeof Notifications !== 'undefined') {
        await Notifications.loadAlerts();
        Notifications.startPeriodicCheck();
      }
      if (typeof StonAPI !== 'undefined') {
        await updateTokenPrices();
      }
      console.log('STON.fi интеграция инициализирована');
    } catch (err) {
      console.error('Init error:', err);
      alert('Ошибка инициализации: ' + err.message);
    }
  };
  init();
});