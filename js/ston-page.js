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
            4. Вставьте в форму добавления
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
    
    for (const token of tokens) {
      const priceData = prices[token.address];
      const priceEl = document.getElementById(`price-${token.address}`);
      const statusEl = document.getElementById(`price-status-${token.address}`);
      const sourceEl = document.getElementById(`price-source-${token.address}`);
      
      if (priceEl) {
        if (priceData && priceData.available && priceData.price > 0) {
          priceEl.textContent = '$' + priceData.price.toFixed(8);
          priceEl.style.color = 'var(--neon-green)';
          
          // Источник данных
          if (sourceEl) {
            sourceEl.textContent = priceData.fromStorage ? '(кэш)' : `(${priceData.source || ''})`;
            sourceEl.style.color = priceData.fromStorage ? 'var(--neon-yellow)' : 'var(--text-secondary)';
          }
          
          // Статус
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

          // ✅ АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ НАЗВАНИЯ ТОКЕНА
          if (priceData.tokenName && priceData.tokenName !== token.name) {
            console.log(`🔄 Обновляем название токена: ${token.name} → ${priceData.tokenName}`);
            try {
              await TokensRegistry.update({ ...token, name: priceData.tokenName });
              // Обновляем отображение названия на странице
              const nameEl = priceEl.closest('.token-item').querySelector('.token-name');
              if (nameEl) nameEl.textContent = priceData.tokenName;
              const iconEl = priceEl.closest('.token-item').querySelector('.token-icon');
              if (iconEl) iconEl.textContent = priceData.tokenName.substring(0, 2).toUpperCase();
            } catch (err) {
              console.error('Ошибка обновления названия:', err);
            }
          }
        } else {
          // Даже если нет данных — показываем последнюю известную цену
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
    }

    const timeEl = document.getElementById('last-update-time');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('ru-RU');
    }
  },

  async refreshTokenPrice(address) {
    // Принудительная очистка кэша для этого токена
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
      <div class="modal-header">
        <h2>Добавить токен</h2>
        <button class="close-btn" id="close-add-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Название токена</label>
          <input type="text" id="new-token-name" class="form-input" placeholder="Напр: VOLT">
        </div>
        <div class="form-group">
          <label>Адрес контракта</label>
          <input type="text" id="new-token-address" class="form-input" placeholder="EQ... или UQ...">
          <span class="form-hint">Формат: EQ или UQ + 46 символов</span>
        </div>
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button class="submit-btn" id="verify-token-btn" style="flex: 1; background: var(--neon-purple);">Проверить</button>
          <button class="submit-btn" id="save-token-btn" style="flex: 1;" disabled>Добавить</button>
        </div>
        <div id="verify-result" style="margin-top: 1rem; padding: 0.75rem; border-radius: 8px; display: none;"></div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    let verifiedAddress = null;

    document.getElementById('close-add-modal').onclick = () => modal.close();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

    document.getElementById('verify-token-btn').onclick = async () => {
      const address = document.getElementById('new-token-address').value.trim();
      const resultEl = document.getElementById('verify-result');
      
      if (!TokensRegistry.isValidAddress(address)) {
        resultEl.style.display = 'block';
        resultEl.style.background = 'rgba(255, 0, 85, 0.1)';
        resultEl.style.color = 'var(--neon-red)';
        resultEl.textContent = '❌ Неверный формат адреса';
        return;
      }

      resultEl.style.display = 'block';
      resultEl.style.background = 'rgba(0, 243, 255, 0.1)';
      resultEl.style.color = 'var(--neon-cyan)';
      resultEl.textContent = '⏳ Проверяем по всем источникам...';

      try {
        const allPools = await StonAPI.getAvailablePools(address);
        console.log('Доступные пулы:', allPools);
        
        const priceData = await StonAPI.getCurrentPrice(address, 'USDT');
        console.log('Результат getCurrentPrice:', priceData);
        
        if (priceData.available && priceData.price > 0) {
          verifiedAddress = address;
          resultEl.style.background = 'rgba(0, 255, 157, 0.1)';
          resultEl.style.color = 'var(--neon-green)';
          let msg = `✅ Цена: $${priceData.price.toFixed(8)}`;
          msg += ` | Источник: ${priceData.source}`;
          if (priceData.poolName) msg += ` | Пул: ${priceData.poolName}`;
          if (priceData.tokenName) msg += ` | Название: ${priceData.tokenName}`;
          if (priceData.priceChange24h !== 0) {
            const sign = priceData.priceChange24h > 0 ? '+' : '';
            msg += ` | 24ч: ${sign}${priceData.priceChange24h.toFixed(2)}%`;
          }
          resultEl.textContent = msg;
          document.getElementById('save-token-btn').disabled = false;
        } else {
          resultEl.style.background = 'rgba(255, 0, 85, 0.1)';
          resultEl.style.color = 'var(--neon-red)';
          if (allPools.length > 0) {
            resultEl.textContent = `⚠️ Пулы найдены (${allPools.length}), но цена = 0.`;
          } else {
            resultEl.textContent = '❌ Токен не найден ни в одном источнике. Проверь адрес.';
          }
        }
      } catch (err) {
        console.error('Verify error:', err);
        resultEl.style.background = 'rgba(255, 0, 85, 0.1)';
        resultEl.style.color = 'var(--neon-red)';
        resultEl.textContent = '❌ Ошибка: ' + err.message;
      }
    };

    document.getElementById('save-token-btn').onclick = async () => {
      const name = document.getElementById('new-token-name').value.trim().toUpperCase();
      
      if (!name) {
        Notifications.showToast('Введите название', 'error');
        return;
      }

      if (!verifiedAddress) {
        Notifications.showToast('Сначала проверьте адрес', 'error');
        return;
      }

      const existing = await TokensRegistry.getByAddress(verifiedAddress);
      if (existing) {
        Notifications.showToast('Такой токен уже добавлен', 'error');
        return;
      }

      try {
        await TokensRegistry.add({
          name,
          address: verifiedAddress,
          dex: 'multi-source'
        });
        
        Notifications.showToast(`Токен ${name} добавлен`, 'success');
        modal.close();
        
        document.getElementById('main-content').innerHTML = await this.render();
        this.bindEvents();
      } catch (err) {
        Notifications.showToast('Ошибка: ' + err.message, 'error');
      }
    };
  },

  openEditModal(token) {
    const modal = document.createElement('dialog');
    modal.id = 'edit-token-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h2>Редактировать токен</h2>
        <button class="close-btn" id="close-edit-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Название токена</label>
          <input type="text" id="edit-token-name" class="form-input" value="${token.name}">
        </div>
        <div class="form-group">
          <label>Адрес контракта</label>
          <input type="text" class="form-input" value="${token.address}" readonly style="opacity: 0.6;">
          <span class="form-hint">Адрес нельзя изменить</span>
        </div>
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button class="submit-btn" id="save-edit-btn" style="flex: 1;">Сохранить</button>
          <button class="submit-btn secondary" id="cancel-edit-btn" style="flex: 1;">Отмена</button>
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
