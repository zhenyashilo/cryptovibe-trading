// Единая система инициализации Firebase
// Гарантирует, что авторизация завершена ДО начала работы с данными

const FirebaseInit = {
  initialized: false,
  initPromise: null,

  // Главная функция: ждёт полной инициализации Firebase
  async ensureInitialized() {
    // Если уже инициализировано — сразу возвращаем
    if (this.initialized && FirebaseClient.isAuthenticated()) {
      return true;
    }

    // Если инициализация уже идёт — ждём её завершения
    if (this.initPromise) {
      return await this.initPromise;
    }

    // Запускаем инициализацию
    this.initPromise = this._doInitialize();
    
    try {
      const result = await this.initPromise;
      this.initialized = true;
      return result;
    } catch (err) {
      this.initPromise = null; // Сбрасываем при ошибке
      throw err;
    }
  },

  // Внутренняя функция инициализации
  async _doInitialize() {
    console.log('🚀 FirebaseInit: начинаем инициализацию...');

    if (typeof FirebaseClient === 'undefined') {
      throw new Error('FirebaseClient не загружен');
    }

    // Ждём авторизации
    await FirebaseClient.init();
    await new Promise(resolve => FirebaseClient.onAuthReady(() => resolve()));

    console.log('✅ FirebaseInit: авторизация завершена');
    console.log('   User:', FirebaseClient.currentUser?.email || 'не авторизован');
    console.log('   UID:', FirebaseClient.currentUser?.uid || 'нет');

    return FirebaseClient.isAuthenticated();
  },

  // Проверка: готов ли Firebase к работе
  isReady() {
    return this.initialized && FirebaseClient.isAuthenticated();
  },

  // Сброс (для отладки)
  reset() {
    this.initialized = false;
    this.initPromise = null;
  }
};
