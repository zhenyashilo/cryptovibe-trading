document.addEventListener('DOMContentLoaded', async () => {
  console.log('Trading App: загрузка...');
  
  // 1. Показываем экран ожидания, пока Firebase проверяет сессию
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0a0a12;color:#fff;font-family:system-ui;">
      <div style="font-size:3rem;margin-bottom:1rem;animation:pulse 1.5s infinite;">⏳</div>
      <div style="font-size:1.2rem;">Проверка авторизации...</div>
      <style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }</style>
    </div>
  `;

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

  // Функция для отображения статуса авторизации в углу экрана
  function renderAuthBadge() {
    const isAuth = typeof FirebaseClient !== 'undefined' && FirebaseClient.isAuthenticated();
    const email = isAuth ? FirebaseClient.getCurrentUser()?.email : 'Гостевой режим';
    const color = isAuth ? 'var(--neon-green, #00ff9d)' : 'var(--neon-yellow, #ffe600)';
    const icon = isAuth ? '🟢' : '🟡';
    const statusText = isAuth ? 'Авторизован (Синхронизация ВКЛ)' : 'Гость (Синхронизация ВЫКЛ)';
    
    let badge = document.getElementById('auth-status-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'auth-status-badge';
      badge.style.cssText = `position:fixed;top:10px;right:10px;background:rgba(10,10,18,0.9);border:1px solid ${color};color:${color};padding:8px 12px;border-radius:8px;font-size:0.8rem;z-index:9999;display:flex;flex-direction:column;gap:4px;backdrop-filter:blur(4px);box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
      document.body.appendChild(badge);
    }
    badge.innerHTML = `<div style="display:flex;align-items:center;gap:6px;font-weight:600;">${icon} ${statusText}</div><div style="color:#a0a0b0;font-size:0.7rem;word-break:break-all;">${email}</div>`;
    badge.style.borderColor = color;
    badge.querySelector('div:first-child').style.color = color;
  }

  try {
    const isGuest = localStorage.getItem('guest_mode') === 'true';
    
    if (typeof FirebaseClient !== 'undefined') {
      // Ждём, пока Firebase ТОЧНО определит состояние
      await FirebaseClient.init();
      
      // Дополнительная гарантия ожидания
      await new Promise(resolve => {
        FirebaseClient.onAuthReady(() => resolve());
      });
      
      if (!FirebaseClient.isAuthenticated() && !isGuest) {
        window.location.href = 'auth.html';
        return;
      }
      
      // Миграция токенов при первом входе
      if (FirebaseClient.isAuthenticated()) {
        console.log('🔄 Проверяем миграцию токенов...');
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
    
    // Восстанавливаем нормальный интерфейс после проверки
    document.body.innerHTML = `
      <nav class="top-nav">
        <div class="logo">Crypto<span>Vibe</span></div>
        <div class="nav-links">
          <a href="#journal">Журнал</a>
          <a href="#plans">Планы</a>
          <a href="#diary">Дневник</a>
          <a href="#stats">Статистика</a>
          <a href="#calculators">Калькуляторы</a>
          <a href="#settings">Настройки</a>
        </div>
      </nav>
      <main id="main-content" style="padding-top: 80px;"></main>
      <dialog id="trade-modal">
        <div class="modal-header">
          <h2 id="modal-title">Новая запись</h2>
          <button class="close-btn" id="close-modal">&times;</button>
        </div>
        <form id="trade-form" class="modal-body">
          <div class="form-row">
            <div class="form-group"><label>Дата</label><input type="date" id="trade-date" class="form-input" required></div>
            <div class="form-group"><label>Время</label><input type="time" id="trade-time" class="form-input" required></div>
          </div>
          <div class="form-group"><label>Токен</label><input type="text" id="trade-token" class="form-input" placeholder="BTC, ETH..." required autocomplete="off"></div>
          <div class="form-row">
            <div class="form-group"><label>Цена входа ($)</label><input type="number" id="trade-entry" class="form-input" step="any" required></div>
            <div class="form-group"><label>Цена выхода ($)</label><input type="number" id="trade-exit" class="form-input" step="any" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Stop Loss ($)</label><input type="number" id="trade-sl" class="form-input" step="any"></div>
            <div class="form-group"><label>Количество</label><input type="number" id="trade-quantity" class="form-input" step="any" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Комиссия ($)</label><input type="number" id="trade-fee" class="form-input" step="any" value="0"></div>
            <div class="form-group"><label>Риск (%)</label><input type="number" id="trade-risk" class="form-input" step="any" value="2"></div>
          </div>
          <div class="form-group">
            <label>Теги</label>
            <input type="text" id="trade-tags-input" class="form-input" placeholder="Введите тег и нажмите Enter или выберите">
            <div id="tag-suggestions" class="tag-suggestions" style="display:none;"></div>
            <div id="selected-tags" class="selected-tags-container"></div>
          </div>
          <div class="form-group"><label>Заметки</label><textarea id="trade-notes" class="form-input" rows="3"></textarea></div>
          <button type="submit" class="submit-btn" style="width:100%;margin-top:1rem;">Сохранить</button>
        </form>
      </dialog>
    `;
    
    // Применяем стили навигации динамически, если их нет в HTML
    if (!document.querySelector('style#nav-styles')) {
      const style = document.createElement('style');
      style.id = 'nav-styles';
      style.textContent = `
        .top-nav { position: fixed; top: 0; left: 0; right: 0; height: 60px; background: rgba(10,10,18,0.95); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; z-index: 1000; }
        .logo { font-size: 1.5rem; font-weight: 700; color: #fff; }
        .logo span { color: #00f3ff; }
        .nav-links { display: flex; gap: 1.5rem; }
        .nav-links a { color: #a0a0b0; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover, .nav-links a.active { color: #00f3ff; }
        @media (max-width: 768px) { .top-nav { flex-direction: column; height: auto; padding: 1rem; } .nav-links { flex-wrap: wrap; justify-content: center; gap: 1rem; margin-top: 0.5rem; } }
      `;
      document.head.appendChild(style);
    }

    handleNavigation();
    window.addEventListener('hashchange', handleNavigation);
    
    // Рисуем индикатор авторизации
    renderAuthBadge();
    
    console.log('✅ Приложение готово');
  } catch (err) {
    console.error('Ошибка:', err);
    document.body.innerHTML = `<div style="padding: 2rem; text-align: center; color: #ff0055;"><h2>Ошибка загрузки</h2><p>${err.message}</p></div>`;
  }

  // ... (весь остальной код обработчиков и функций render остаётся БЕЗ ИЗМЕНЕНИЙ, как в предыдущем полном файле) ...
  // Чтобы не раздувать сообщение, ниже я привожу только ключевые места, где вызывается renderAuthBadge()
  
  // ВАЖНО: Добавь вызов renderAuthBadge() в конец функции handleNavigation(), чтобы статус обновлялся при смене вкладок:
  /*
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
    
    // Обновляем бейдж авторизации при каждой смене экрана
    renderAuthBadge(); 
  }
  */
