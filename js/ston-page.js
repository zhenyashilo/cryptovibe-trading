// Страница управления токенами STON.fi
const StonPage = {
  async render() {
    const tokens = await TokensRegistry.getAll();
    
    return `
      <header class="page-header">
        <h1>Токены STON.fi</h1>
        <p>Управление токенами для отслеживания курсов и уведомлений</p>
      </header>

      <section class="stats-grid">
        <article class="stat-card">
          <h3>Всего токенов</h3>
          <p class="metric-value">${tokens.length}</p>
        </article>
        <article class="stat-card">
          <h3>С алертами</h3>
          <p class="metric-value">${tokens.filter(t => {
            const alert = Notifications.getAlert(t.address);
            return alert && alert.rules && alert.rules.some(r => r.enabled);
          }).length}</p>
        </article>
        <article class="stat-card">
          <h3>Последнее обновление</h3>
          <p class="metric-value" style="font-size: 1rem;" id="last-update-time">—</p>
        </article>
      </section>

      <section class="section">
        <div class="section-header">
          <h2>Мои токены</h2>
          <button class="submit-btn" id="add-token-btn" style="margin: 0; padding: 0.5rem 1rem; font-size: 0.9rem;">+ Добавить токен</button>
        </div>

        <div class="token-list" id="ston-tokens-list">
          ${tokens.length > 0 ? tokens.map(t => this._renderTokenCard(t)).join('') : 
            '<div class="empty-state">Нет добавленных токенов. Нажмите "Добавить токен".</div>'}
        </div>
      </section>

      <section class="section">
        <div class="stat-card">
          <h3>🔍 Как найти адрес токена</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem; line-height: 1.6;">
            1. Откройте <a href="https://ston.fi/tokens" target="_blank" style="color: var(--neon-cyan);">ston.fi/tokens</a><br>
            2. Найдите нужный токен<br>
            3. Скопируйте адрес контракта (начинается с EQ... или UQ...)<br>
            4. Вставьте в форму добавления — название подтянется автоматически
          </p>
        </div>
      </section>
    `;
  },

  _renderTokenCard(token) {
    const alert = Notifications.getAlert(token.address);
    const activeRules = alert?.rules?.filter(r => r.enabled).length || 0;
    
    return `
      <div class="token-item" data-address="${token.address}" style="cursor: default;">
        <div class="token-info">
          <div class="token-icon">${token.name.substring(0, 2).toUpperCase()}</div>
          <div style="flex: 1;">
            <div class="token-name">${token.name}</div>
            <div class="token-sub" style="font-family: monospace; font-size: 0.7rem;">
              ${token.address.slice(0, 10)}...${token.address.slice(-8)}
            </div>
            <div style="margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.2rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="token-quantity" id="price-${token.address}" style="font-weight: 600;">Загрузка...</span>
                <span id="price-source-${token.address}" style="font-size: 0.7rem; color: var(--text-secondary);"></span>
              </div>
              <div id="price-status-${token.address}" style="font-size: 0.75rem; color: var(--text-secondary); min-height: 1rem;"></div>
            </div>
            ${activeRules > 0 ? `<div style="margin-top: 0.25rem;"><span class="token-quantity" style="background: rgba(255, 230, 0, 0.15); color: var(--neon-yellow); font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 4px;">🔔 ${activeRules} алерт(ов)</span></div>` : ''}
          </div>
        </div>
        <div class="tx-actions" style="gap: 0.5rem;">
          <button class="tx-action-btn" data-action="alerts" data-address="${token.address}" title="Алерты">🔔</button>
          <button class="tx-action-btn" data-action="refresh" data-address="${token.address}" title="Обновить курс">🔄</button>
          <button class="tx-action-btn" data-action="edit" data-address="${token.address}" title="Редактировать">✏️</button>
          <button class="tx-action-btn delete" data-action="delete" data-address="${token.address}" title="Удалить">🗑️</button>
        </div>
      </div>
    `;
  },

  bindEvents() {
    document.getElementById('add-token-btn')?.addEventListener('click', () => {
      this.openAddModal();
    });

    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const action = btn.dataset.action;
        const address = btn.dataset.address;
        const tokens = await TokensRegistry.getAll();
        const token = tokens.find(t => t.address === address);
        if (!token) return;
        switch (action) {
          case 'alerts':
            AlertsUI.openAlertsModal(token);
            break;
          case 'refresh':
            await this.refreshTokenPrice(address);
            break;
          case 'edit':
            this.openEditModal(token);
            break;
          case 'delete':
            if (confirm(`Удалить токен ${token.name}?`)) {
              await TokensRegistry.delete(token.id);
              await Notifications.deleteAlert(address);
              document.getElementById('main-content').innerHTML = await this.render();
              this.bindEvents();
              this.loadPrices();
            }
            break;
        }
      });
    });

    this.loadPrices();
  },

  async loadPrices() {
    const tokens = await TokensRegistry.getAll();
    if (tokens.length === 0) return;
    
    const addresses = tokens.map(t => t.address);
    const prices = await StonAPI.getMultiplePrices(addresses);
    
    tokens.forEach(token => {
      const priceData = prices[token.address];
      const priceEl = document.getElementById(`price-${token.address}`);
      const statusEl = document.getElementById(`price-status-${token.address}`);
      const sourceEl = document.getElementById(`price-source-${token.address}`);
      
      if (priceEl) {
        if (priceData && priceData.available && priceData.price > 0) {
          priceEl.textContent = '$' + priceData.price.toFixed(8);
          priceEl.style.color = 'var(--neon-green)';
          
          if (sourceEl) {
            sourceEl.textContent = priceData.fromStorage ? '(кэш)' : `(${priceData.source || ''})`;
            sourceEl.style.color = priceData.fromStorage ? 'var(--neon-yellow)' : 'var(--text-secondary)';
          }
          
          if (statusEl) {
            if (priceData.fromStorage) {
              const minutesAgo = Math.floor((Date.now() - (priceData.lastSuccessfulTime || priceData.timestamp)) / 60000);
              if (minutesAgo < 1) {
                statusEl.innerHTML = '⚠️ Данные из кэша (только что)';
              } else {
                statusEl.innerHTML = `⚠️ Данные из кэша (${minutesAgo} мин назад)`;
              }
              statusEl.style.color = 'var(--neon-yellow)';
            } else {
              const secondsAgo = Math.floor((Date.now() - priceData.timestamp) / 1000);
              if (secondsAgo < 60) {
                statusEl.innerHTML = '✅ Обновлено только что';
              } else {
                const minutesAgo = Math.floor(secondsAgo / 60);
                statusEl.innerHTML = `✅ Обновлено ${minutesAgo} мин назад`;
              }
              statusEl.style.color = 'var(--neon-green)';
            }
          }
        } else {
          const lastKnown = StonAPI.getLastKnownPrice(token.address);
          if (lastKnown && lastKnown.price > 0) {
            priceEl.textContent = '$' + lastKnown.price.toFixed(8);
            priceEl.style.color = 'var(--neon-yellow)';
            
            if (sourceEl) {
              sourceEl.textContent = `(кэш: ${lastKnown.source || 'unknown'})`;
              sourceEl.style.color = 'var(--neon-yellow)';
            }
            
            if (statusEl) {
              const minutesAgo = Math.floor((Date.now() - (lastKnown.timestamp || 0)) / 60000);
              statusEl.innerHTML = `⚠️ Кэш: ${minutesAgo} мин назад`;
              statusEl.style.color = 'var(--neon-yellow)';
            }
          } else {
            priceEl.textContent = 'Нет данных';
            priceEl.style.color = 'var(--neon-red)';
            if (statusEl) {
              statusEl.innerHTML = '❌ Ни один источник не ответил';
              statusEl.style.color = 'var(--neon-red)';
            }
            if (sourceEl) sourceEl.textContent = '';
          }
        }
      }
    });

    const timeEl = document.getElementById('last-update-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('ru-RU');
    }
  },

  async refreshTokenPrice(address) {
    StonAPI._cache.delete(address + ':USD');
    
    const priceEl = document.getElementById(`price-${address}`);
    const statusEl = document.getElementById(`price-status-${address}`);
    const sourceEl = document.getElementById(`price-source-${address}`);
    
    if (priceEl) {
      priceEl.textContent = 'Обновление...';
      priceEl.style.color = 'var(--neon-cyan)';
    }
    if (statusEl) {
      statusEl.innerHTML = '⏳ Запрос ко всем источникам...';
      statusEl.style.color = 'var(--neon-cyan)';
    }
    if (sourceEl) sourceEl.textContent = '';
    
    await this.loadPrices();
    Notifications.showToast('Курс обновлён', 'success', 2000);
  },

  openAddModal() {
    const modal = document.createElement('dialog');
    modal.id = 'add-token-modal';
    modal.innerHTML = `
      <div class="modal-header" style="padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.25rem;">Добавить токен</h2>
        <button class="close-btn" id="close-add-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.25rem; display: grid; gap: 1rem;">
        <div class="form-group" style="display: grid; gap: 0.4rem;">
          <label style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Адрес контракта</label>
          <input type="text" id="new-token-address" class="form-input" placeholder="EQ... или UQ... (48 символов)" autocomplete="off">
          <span class="form-hint" style="font-size: 0.75rem; color: var(--text-secondary);">Вставьте адрес — название и цена подтянутся автоматически</span>
        </div>
        
        <div id="token-preview" style="display: none; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div id="preview-icon" style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; color: #fff;"></div>
            <div style="flex: 1;">
              <div id="preview-name" style="font-weight: 600; font-size: 1.1rem;"></div>
              <div id="preview-symbol" style="font-size: 0.8rem; color: var(--text-secondary);"></div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-secondary);">Цена:</span> <span id="preview-price" style="color: var(--neon-green); font-weight: 600;"></span></div>
            <div><span style="color: var(--text-secondary);">24ч:</span> <span id="preview-change"></span></div>
            <div><span style="color: var(--text-secondary);">DEX:</span> <span id="preview-dex"></span></div>
            <div><span style="color: var(--text-secondary);">Пул:</span> <span id="preview-pool"></span></div>
          </div>
        </div>
        
        <div id="loading-state" style="display: none; text-align: center; padding: 1rem;">
          <div style="font-size: 1.5rem; animation: pulse 1s infinite;">⏳</div>
          <div style="color: var(--text-secondary); margin-top: 0.5rem;">Ищем токен...</div>
        </div>
        
        <div id="error-state" style="display: none; background: rgba(255, 0, 85, 0.1); border: 1px solid rgba(255, 0, 85, 0.3); border-radius: 8px; padding: 0.75rem; color: var(--neon-red); font-size: 0.9rem;"></div>
        
        <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
          <button class="submit-btn" id="save-token-btn" style="flex: 1;" disabled>Добавить токен</button>
          <button class="submit-btn secondary" id="cancel-add-btn" style="flex: 1; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--glass-border);">Отмена</button>
        </div>
      </div>
      <style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    let tokenInfo = null;
    let debounceTimer = null;

    document.getElementById('close-add-modal').onclick = () => modal.close();
    document.getElementById('cancel-add-btn').onclick = () => modal.close();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

    const addressInput = document.getElementById('new-token-address');
    const previewEl = document.getElementById('token-preview');
    const loadingEl = document.getElementById('loading-state');
    const errorEl = document.getElementById('error-state');
    const saveBtn = document.getElementById('save-token-btn');

    addressInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const address = addressInput.value.trim();
      
      // Сбрасываем состояние
      previewEl.style.display = 'none';
      loadingEl.style.display = 'none';
      errorEl.style.display = 'none';
      saveBtn.disabled = true;
      tokenInfo = null;

      // Валидация формата
      if (!TokensRegistry.isValidAddress(address)) {
        if (address.length > 5) {
          errorEl.style.display = 'block';
          errorEl.textContent = '❌ Неверный формат адреса (должен начинаться с EQ или UQ и содержать 48 символов)';
        }
        return;
      }

      // Показываем загрузку
      loadingEl.style.display = 'block';

      // Дебаунс запроса
      debounceTimer = setTimeout(async () => {
        try {
          const info = await StonAPI.getTokenInfo(address);
          loadingEl.style.display = 'none';

          if (!info) {
            errorEl.style.display = 'block';
            errorEl.textContent = '❌ Токен не найден. Проверь адрес или попробуй позже.';
            return;
          }

          tokenInfo = info;

          // Заполняем превью
          document.getElementById('preview-icon').textContent = info.symbol.substring(0, 2).toUpperCase();
          document.getElementById('preview-name').textContent = info.name;
          document.getElementById('preview-symbol').textContent = `${info.symbol} • ${info.chainId.toUpperCase()}`;
          document.getElementById('preview-price').textContent = '$' + info.priceUsd.toFixed(8);
          
          const changeEl = document.getElementById('preview-change');
          const changeSign = info.priceChange24h >= 0 ? '+' : '';
          changeEl.textContent = `${changeSign}${info.priceChange24h.toFixed(2)}%`;
          changeEl.style.color = info.priceChange24h >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
          
          document.getElementById('preview-dex').textContent = info.dex;
          document.getElementById('preview-pool').textContent = info.poolName;

          previewEl.style.display = 'block';
          saveBtn.disabled = false;
        } catch (err) {
          loadingEl.style.display = 'none';
          errorEl.style.display = 'block';
          errorEl.textContent = '❌ Ошибка: ' + err.message;
        }
      }, 500);
    });

    saveBtn.onclick = async () => {
      if (!tokenInfo) {
        Notifications.showToast('Сначала дождитесь загрузки данных', 'error');
        return;
      }

      // Проверяем не добавлен ли уже
      const existing = await TokensRegistry.getByAddress(tokenInfo.address);
      if (existing) {
        Notifications.showToast('Этот токен уже добавлен', 'error');
        return;
      }

      try {
        await TokensRegistry.add({
          name: tokenInfo.name.toUpperCase(),
          symbol: tokenInfo.symbol,
          address: tokenInfo.address,
          dex: tokenInfo.dex,
          chainId: tokenInfo.chainId
        });
        
        Notifications.showToast(`Токен ${tokenInfo.name} добавлен`, 'success');
        modal.close();
        
        document.getElementById('main-content').innerHTML = await this.render();
        this.bindEvents();
        this.loadPrices();
      } catch (err) {
        Notifications.showToast('Ошибка: ' + err.message, 'error');
      }
    };
  },

  openEditModal(token) {
    const modal = document.createElement('dialog');
    modal.id = 'edit-token-modal';
    modal.innerHTML = `
      <div class="modal-header" style="padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.25rem;">Редактировать токен</h2>
        <button class="close-btn" id="close-edit-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.25rem; display: grid; gap: 1rem;">
        <div class="form-group" style="display: grid; gap: 0.4rem;">
          <label style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Название токена</label>
          <input type="text" id="edit-token-name" class="form-input" value="${token.name}">
        </div>
        <div class="form-group" style="display: grid; gap: 0.4rem;">
          <label style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">Адрес контракта</label>
          <input type="text" class="form-input" value="${token.address}" readonly style="opacity: 0.6;">
          <span class="form-hint" style="font-size: 0.75rem; color: var(--text-secondary);">Адрес нельзя изменить</span>
        </div>
        <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
          <button class="submit-btn" id="save-edit-btn" style="flex: 1;">Сохранить</button>
          <button class="submit-btn secondary" id="cancel-edit-btn" style="flex: 1; background: var(--bg-input); color: var(--text-primary); border: 1px solid var(--glass-border);">Отмена</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    document.getElementById('close-edit-modal').onclick = () => modal.close();
    document.getElementById('cancel-edit-btn').onclick = () => modal.close();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

    document.getElementById('save-edit-btn').onclick = async () => {
      const newName = document.getElementById('edit-token-name').value.trim().toUpperCase();
      if (!newName) {
        Notifications.showToast('Введите название', 'error');
        return;
      }
      try {
        await TokensRegistry.update({ ...token, name: newName });
        Notifications.showToast('Токен обновлён', 'success');
        modal.close();
        document.getElementById('main-content').innerHTML = await this.render();
        this.bindEvents();
        this.loadPrices();
      } catch (err) {
        Notifications.showToast('Ошибка: ' + err.message, 'error');
      }
    };
  }
};
