// Система уведомлений: toast + Notification API + Алерты трейдинга

const Notifications = {
  _alerts: new Map(),
  CHECK_INTERVAL: 5 * 60 * 1000, // Проверка каждые 5 минут
  _intervalId: null,

  // Настройки алертов трейдинга
  tradingSettings: {
    priceAlerts: true,
    portfolioAlerts: true,
    reminders: true,
    sound: true,
    drawdownPercent: 10,
    losingStreak: 3,
    dailyLossLimit: 5,
    reminderTime: '20:00'
  },

  // ===== TOAST УВЕДОМЛЕНИЯ =====
  showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === 'success' ? '🎯' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
        <div>
          <div class="toast-title">${type === 'success' ? 'Успех' : type === 'error' ? 'Ошибка' : type === 'warning' ? 'Внимание' : 'Инфо'}</div>
          <div class="toast-message">${message}</div>
        </div>
      </div>
      <button class="toast-close">&times;</button>
    `;
    
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: var(--bg-secondary);
      border: 1px solid ${type === 'success' ? 'var(--neon-green)' : type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)'};
      border-left: 4px solid ${type === 'success' ? 'var(--neon-green)' : type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)'};
      color: var(--text-primary); padding: 1rem 1.25rem; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 10000; display: flex;
      align-items: center; gap: 0.75rem; max-width: 400px; animation: slideIn 0.3s ease-out;
    `;
    
    const content = toast.querySelector('.toast-content');
    content.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; flex: 1;';
    content.querySelector('.toast-title').style.cssText = 'font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;';
    content.querySelector('.toast-message').style.cssText = 'font-size: 0.85rem; color: var(--text-secondary);';
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.style.cssText = 'background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1;';
    closeBtn.onclick = () => this._removeToast(toast);
    
    document.body.appendChild(toast);
    setTimeout(() => this._removeToast(toast), duration);
  },

  _removeToast(toast) {
    if (!toast.parentNode) return;
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
    
    // Звук для предупреждений и ошибок
    if (this.tradingSettings.sound && (toast.className.includes('toast-warning') || toast.className.includes('toast-error'))) {
      try { 
        new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS57OihUBELTKXh8bllHAU2j9XuznkpBSh+zPDajzsKFWC06OyrWBUIQ5zd8sFuJAUuhM/z24k2CBhku+zooVARC0yl4fG5ZRwFNo/U7s55KQUofsz').play().catch(()=>{}); 
      } catch(e){}
    }
  },

  // ===== NOTIFICATION API =====
  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return await Notification.requestPermission();
    } catch (err) { return 'denied'; }
  },

  async sendNotification(title, body) {
    const permission = await this.requestPermission();
    if (permission !== 'granted') return false;
    try {
      new Notification(title, {
        body,
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAAbklEQVRYR+2XQQ6AIAwE6f9P9uLFq4mJhQKFnEwv1Mww0AJF8rZtSyIiMkMzM10BImIyM13dE5CZmZnZzOwKmJnZzOwKmJnZzOwKmJnZzOwKmJnZzOwKmJnZzOwKmJnZzOwKmJnZzOwKmJnZzOwK/A0A8F0E8QAAAABJRU5ErkJggg==',
        tag: 'cryptovibe-alert'
      });
      return true;
    } catch (err) { return false; }
  },

  // ===== АЛЕРТЫ (Базовые + Трейдинг) =====
  async loadAlerts() {
    try {
      if (typeof dbPromise !== 'undefined') {
        const db = await dbPromise;
        if (db.objectStoreNames.contains('alerts')) {
          const tx = db.transaction('alerts', 'readonly');
          const req = tx.objectStore('alerts').getAll();
          req.onsuccess = () => {
            this._alerts = new Map((req.result || []).map(a => [a.tokenAddress, a]));
          };
        }
      }
      const saved = localStorage.getItem('trading_alert_settings');
      if (saved) this.tradingSettings = { ...this.tradingSettings, ...JSON.parse(saved) };
    } catch (err) { console.error('Load alerts error:', err); }
  },

  async saveAlert(alertData) {
    try {
      if (typeof dbPromise !== 'undefined') {
        const db = await dbPromise;
        const tx = db.transaction('alerts', 'readwrite');
        tx.objectStore('alerts').put(alertData);
      }
      this._alerts.set(alertData.tokenAddress, alertData);
    } catch (err) { console.error('Save alert error:', err); }
  },

  getAlert(tokenAddress) { return this._alerts.get(tokenAddress) || null; },

  async deleteAlert(tokenAddress) {
    try {
      if (typeof dbPromise !== 'undefined') {
        const db = await dbPromise;
        db.transaction('alerts', 'readwrite').objectStore('alerts').delete(tokenAddress);
      }
      this._alerts.delete(tokenAddress);
    } catch (err) { console.error('Delete alert error:', err); }
  },

  async checkAllAlerts() {
    // 1. Базовые алерты по токенам
    if (typeof TokensRegistry !== 'undefined' && typeof StonAPI !== 'undefined') {
      const tokens = await TokensRegistry.getAll();
      if (tokens.length > 0) {
        const addresses = tokens.map(t => t.address);
        const prices = await StonAPI.getMultiplePrices(addresses);
        
        for (const token of tokens) {
          const alert = this.getAlert(token.address);
          if (!alert || !alert.rules) continue;
          const priceData = prices[token.address];
          if (!priceData || priceData.price === null) continue;
          
          const currentPrice = priceData.price;
          const lastPrice = alert.lastPrice || currentPrice;
          
          for (const rule of alert.rules) {
            if (!rule.enabled) continue;
            let isTriggered = false;
            let msg = '';
            if (rule.type === 'percent_up' && ((currentPrice - lastPrice) / lastPrice) * 100 >= rule.value) {
              isTriggered = true; msg = `${token.name} вырос на ${((currentPrice - lastPrice) / lastPrice * 100).toFixed(2)}%`;
            } else if (rule.type === 'percent_down' && ((lastPrice - currentPrice) / lastPrice) * 100 >= rule.value) {
              isTriggered = true; msg = `${token.name} упал на ${((lastPrice - currentPrice) / lastPrice * 100).toFixed(2)}%`;
            } else if (rule.type === 'price_above' && currentPrice >= rule.value) {
              isTriggered = true; msg = `${token.name} достиг $${currentPrice.toFixed(8)}`;
            } else if (rule.type === 'price_below' && currentPrice <= rule.value) {
              isTriggered = true; msg = `${token.name} упал до $${currentPrice.toFixed(8)}`;
            }
            
            if (isTriggered) {
              this.showToast(msg, 'warning', 8000);
              if (alert.usePush) await this.sendNotification('CryptoVibe Alert', msg);
              rule.enabled = false;
            }
          }
          alert.lastPrice = currentPrice;
          await this.saveAlert(alert);
        }
      }
    }

    // 2. Алерты трейдинга
    await this.checkTradingAlerts();
  },

  async checkTradingAlerts() {
    if (typeof TradingDB === 'undefined') return;
    const s = this.tradingSettings;

    try {
      // --- Алерты по планам ---
      if (s.priceAlerts && typeof StonAPI !== 'undefined') {
        const plans = await TradingDB.getAllPlans();
        const activePlans = plans.filter(p => p.status === 'pending');
        if (activePlans.length > 0) {
          const tokens = await TokensRegistry.getAll();
          const tokenMap = {};
          tokens.forEach(t => { tokenMap[t.name.toUpperCase()] = t.address; });
          
          const addresses = activePlans.filter(p => tokenMap[p.token]).map(p => tokenMap[p.token]);
          if (addresses.length > 0) {
            const prices = await StonAPI.getMultiplePrices(addresses);
            for (const plan of activePlans) {
              const addr = tokenMap[plan.token];
              if (!addr || !prices[addr]?.price) continue;
              
              const cp = prices[addr].price;
              const cooldown = 30 * 60 * 1000; // 30 минут
              const lastAlert = localStorage.getItem(`t_alert_${plan.id}`);
              if (lastAlert && Date.now() - parseInt(lastAlert) < cooldown) continue;

              if (cp <= plan.plannedSL) {
                const msg = `${plan.token} достиг Stop Loss! ($${cp.toFixed(8)})`;
                this.showToast(msg, 'error');
                await this.sendNotification('Stop Loss', msg);
                localStorage.setItem(`t_alert_${plan.id}`, Date.now().toString());
              } else if (cp >= plan.plannedTP) {
                const msg = `${plan.token} достиг Take Profit! 🎯 ($${cp.toFixed(8)})`;
                this.showToast(msg, 'success');
                await this.sendNotification('Take Profit', msg);
                localStorage.setItem(`t_alert_${plan.id}`, Date.now().toString());
              } else if (Math.abs(cp - plan.plannedEntry) <= plan.plannedEntry * 0.05) {
                const lastEntry = localStorage.getItem(`t_alert_${plan.id}_entry`);
                if (!lastEntry || Date.now() - parseInt(lastEntry) > cooldown) {
                  this.showToast(`${plan.token} близко к точке входа`, 'info');
                  localStorage.setItem(`t_alert_${plan.id}_entry`, Date.now().toString());
                }
              }
            }
          }
        }
      }

      // --- Алерты по портфелю ---
      if (s.portfolioAlerts && typeof TradingStats !== 'undefined') {
        const trades = await TradingDB.getAll();
        if (trades.length > 0) {
          const initialDeposit = (await TradingDB.getSetting('initialDeposit')) || 100;
          const stats = TradingStats.calculate(trades, initialDeposit);
          
          // Просадка
          if (stats.netProfit < 0) {
            const dd = Math.abs(stats.netProfit / initialDeposit * 100);
            if (dd >= s.drawdownPercent) {
              const last = localStorage.getItem('t_alert_dd');
              if (!last || Date.now() - parseInt(last) > 24*60*60*1000) {
                this.showToast(`Просадка портфеля: ${dd.toFixed(1)}%`, 'error');
                localStorage.setItem('t_alert_dd', Date.now().toString());
              }
            }
          }
          
          // Серия убытков
          const recent = [...trades].sort((a,b) => new Date(b.date+'T'+b.time) - new Date(a.date+'T'+a.time)).slice(0, s.losingStreak);
          if (recent.length >= s.losingStreak && recent.every(t => TradingStats.calculatePnL(t) < 0)) {
            const last = localStorage.getItem('t_alert_ls');
            if (!last || Date.now() - parseInt(last) > 24*60*60*1000) {
              this.showToast(`Серия из ${s.losingStreak} убыточных сделок!`, 'warning');
              localStorage.setItem('t_alert_ls', Date.now().toString());
            }
          }

          // Дневной лимит
          const today = new Date().toISOString().split('T')[0];
          const todayPnL = trades.filter(t => t.date === today).reduce((sum, t) => sum + TradingStats.calculatePnL(t), 0);
          const dailyLoss = Math.abs(todayPnL / initialDeposit * 100);
          if (todayPnL < 0 && dailyLoss >= s.dailyLossLimit) {
            const last = localStorage.getItem('t_alert_dl');
            if (!last || Date.now() - parseInt(last) > 24*60*60*1000) {
              this.showToast(`Дневной лимит убытков: ${dailyLoss.toFixed(1)}%`, 'error');
              localStorage.setItem('t_alert_dl', Date.now().toString());
            }
          }
        }
      }

      // --- Напоминания ---
      if (s.reminders) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        if (currentTime === s.reminderTime) {
          const today = now.toISOString().split('T')[0];
          if (localStorage.getItem('t_alert_reminder') !== today) {
            this.showToast('Время проанализировать сделки и заполнить дневник!', 'info', 10000);
            localStorage.setItem('t_alert_reminder', today);
          }
        }
      }
    } catch (e) { console.error('Trading alerts error:', e); }
  },

  startPeriodicCheck() {
    if (this._intervalId) return;
    this.checkAllAlerts();
    this._intervalId = setInterval(() => this.checkAllAlerts(), this.CHECK_INTERVAL);
  },

  stopPeriodicCheck() {
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
  },

  saveTradingSettings(settings) {
    this.tradingSettings = { ...this.tradingSettings, ...settings };
    localStorage.setItem('trading_alert_settings', JSON.stringify(this.tradingSettings));
  }
};

// Стили анимации
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
`;
document.head.appendChild(toastStyles);