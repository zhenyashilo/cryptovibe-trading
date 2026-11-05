// Модуль управления алертами для токенов
// Работает с объектом Notifications из notifications.js

const AlertsUI = {
  // Открыть модалку алертов для токена
  async openAlertsModal(token) {
    // Удаляем старую модалку если есть
    const oldModal = document.getElementById('alerts-modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('dialog');
    modal.id = 'alerts-modal';
    modal.innerHTML = `
      <div class="modal-header" style="padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <h2 style="font-size: 1.25rem;">🔔 Алерты для ${token.name}</h2>
        <button class="close-btn" id="close-alerts-modal" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.25rem; display: grid; gap: 1rem;">
        <div class="detail-card" style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <label style="font-size: 0.85rem; color: var(--text-secondary);">Текущий курс:</label>
            <span style="color: var(--neon-cyan); font-weight: 600;">$${(window._currentPrices?.[token.name] || 0).toFixed(8)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <label style="font-size: 0.85rem; color: var(--text-secondary);">Адрес:</label>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">${token.address.slice(0, 8)}...${token.address.slice(-6)}</span>
          </div>
        </div>

        <h3 style="margin: 0.5rem 0; font-size: 1rem; font-weight: 600;">Правила уведомлений</h3>
        
        <div class="alert-rule" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <input type="checkbox" id="rule-percent-up" style="width: 18px; height: 18px; cursor: pointer;">
          <label for="rule-percent-up" style="flex: 1; cursor: pointer;">Рост цены на</label>
          <input type="number" id="rule-percent-up-value" class="form-input" value="20" min="1" max="1000" style="width: 80px; padding: 0.4rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--text-primary);">
          <span>%</span>
        </div>

        <div class="alert-rule" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <input type="checkbox" id="rule-percent-down" style="width: 18px; height: 18px; cursor: pointer;">
          <label for="rule-percent-down" style="flex: 1; cursor: pointer;">Падение цены на</label>
          <input type="number" id="rule-percent-down-value" class="form-input" value="10" min="1" max="1000" style="width: 80px; padding: 0.4rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--text-primary);">
          <span>%</span>
        </div>

        <div class="alert-rule" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <input type="checkbox" id="rule-price-above" style="width: 18px; height: 18px; cursor: pointer;">
          <label for="rule-price-above" style="flex: 1; cursor: pointer;">Цена выше</label>
          <input type="number" id="rule-price-above-value" class="form-input" value="0" step="any" style="width: 120px; padding: 0.4rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--text-primary);">
          <span>$</span>
        </div>

        <div class="alert-rule" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <input type="checkbox" id="rule-price-below" style="width: 18px; height: 18px; cursor: pointer;">
          <label for="rule-price-below" style="flex: 1; cursor: pointer;">Цена ниже</label>
          <input type="number" id="rule-price-below-value" class="form-input" value="0" step="any" style="width: 120px; padding: 0.4rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: var(--text-primary);">
          <span>$</span>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
          <input type="checkbox" id="use-push" style="width: 18px; height: 18px; cursor: pointer;">
          <label for="use-push" style="cursor: pointer;">Push-уведомления (браузер)</label>
        </div>

        <div id="alerts-status" style="font-size: 0.85rem; min-height: 1.2rem;"></div>

        <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
          <button class="submit-btn" id="save-alerts-btn" style="flex: 1; background: var(--neon-cyan); color: #000; border: none; border-radius: 8px; padding: 0.85rem; font-weight: 600; cursor: pointer;">💾 Сохранить правила</button>
          <button class="submit-btn secondary" id="cancel-alerts-btn" style="flex: 1; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.85rem; font-weight: 600; cursor: pointer;">Отмена</button>
        </div>

        <div id="existing-alerts-info" style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin-top: 0.5rem;"></div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    // Обработчики закрытия
    document.getElementById('close-alerts-modal').onclick = () => modal.close();
    document.getElementById('cancel-alerts-btn').onclick = () => modal.close();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });

    // Загрузка существующих правил
    const existingAlert = typeof Notifications !== 'undefined' ? Notifications.getAlert(token.address) : null;
    if (existingAlert && existingAlert.rules) {
      const statusEl = document.getElementById('existing-alerts-info');
      const activeRules = existingAlert.rules.filter(r => r.enabled);
      statusEl.textContent = `Активных правил: ${activeRules.length} из ${existingAlert.rules.length}`;
      
      for (const rule of existingAlert.rules) {
        if (rule.type === 'percent_up') {
          document.getElementById('rule-percent-up').checked = rule.enabled;
          document.getElementById('rule-percent-up-value').value = rule.value;
        } else if (rule.type === 'percent_down') {
          document.getElementById('rule-percent-down').checked = rule.enabled;
          document.getElementById('rule-percent-down-value').value = rule.value;
        } else if (rule.type === 'price_above') {
          document.getElementById('rule-price-above').checked = rule.enabled;
          document.getElementById('rule-price-above-value').value = rule.value;
        } else if (rule.type === 'price_below') {
          document.getElementById('rule-price-below').checked = rule.enabled;
          document.getElementById('rule-price-below-value').value = rule.value;
        }
      }
      document.getElementById('use-push').checked = existingAlert.usePush || false;
    }

    // Сохранение правил
    document.getElementById('save-alerts-btn').onclick = async () => {
      const rules = [];
      const statusEl = document.getElementById('alerts-status');
      
      if (document.getElementById('rule-percent-up').checked) {
        rules.push({
          type: 'percent_up',
          value: parseFloat(document.getElementById('rule-percent-up-value').value) || 20,
          enabled: true
        });
      }
      if (document.getElementById('rule-percent-down').checked) {
        rules.push({
          type: 'percent_down',
          value: parseFloat(document.getElementById('rule-percent-down-value').value) || 10,
          enabled: true
        });
      }
      if (document.getElementById('rule-price-above').checked) {
        rules.push({
          type: 'price_above',
          value: parseFloat(document.getElementById('rule-price-above-value').value) || 0,
          enabled: true
        });
      }
      if (document.getElementById('rule-price-below').checked) {
        rules.push({
          type: 'price_below',
          value: parseFloat(document.getElementById('rule-price-below-value').value) || 0,
          enabled: true
        });
      }

      if (rules.length === 0) {
        statusEl.style.color = 'var(--neon-red)';
        statusEl.textContent = '⚠️ Выбери хотя бы одно правило!';
        return;
      }

      const alertData = {
        tokenAddress: token.address,
        tokenName: token.name,
        rules,
        usePush: document.getElementById('use-push').checked,
        lastPrice: window._currentPrices?.[token.name] || 0,
        lastCheck: Date.now()
      };

      try {
        if (typeof Notifications !== 'undefined') {
          await Notifications.saveAlert(alertData);
          statusEl.style.color = 'var(--neon-green)';
          statusEl.textContent = `✅ Сохранено ${rules.length} правил(а)`;
          
          // Запускаем проверку если ещё не запущена
          if (Notifications._intervalId === null) {
            Notifications.startPeriodicCheck();
          }
          
          setTimeout(() => modal.close(), 1000);
        } else {
          statusEl.style.color = 'var(--neon-red)';
          statusEl.textContent = '❌ Модуль уведомлений не загружен';
        }
      } catch (err) {
        statusEl.style.color = 'var(--neon-red)';
        statusEl.textContent = '❌ Ошибка: ' + err.message;
      }
    };
  },

  // Удалить алерт для токена
  async deleteAlert(tokenAddress) {
    if (typeof Notifications !== 'undefined') {
      await Notifications.deleteAlert(tokenAddress);
      if (typeof Notifications.showToast === 'function') {
        Notifications.showToast('Алерт удалён', 'info');
      }
    }
  },

  // Показать статус алертов для токена
  getAlertStatus(tokenAddress) {
    if (typeof Notifications === 'undefined') return null;
    return Notifications.getAlert(tokenAddress);
  }
};