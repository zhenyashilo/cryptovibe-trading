// Модуль управления токенами STON.fi
// Хранит список токенов с адресами контрактов в IndexedDB

const TokensRegistry = {
  STORE_NAME: 'stonTokens',

  async _getStore() {
    const db = await dbPromise;
    if (!db.objectStoreNames.contains(this.STORE_NAME)) {
      console.warn('Store stonTokens не создан. Обновите DB_VERSION.');
      return null;
    }
    return db;
  },

  async getAll() {
    const db = await this._getStore();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async add(token) {
    const db = await this._getStore();
    if (!db) throw new Error('DB не готова');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.add({
        ...token,
        id: token.id || crypto.randomUUID(),
        createdAt: Date.now()
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async update(token) {
    const db = await this._getStore();
    if (!db) throw new Error('DB не готова');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.put(token);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    const db = await this._getStore();
    if (!db) throw new Error('DB не готова');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getByAddress(address) {
    const all = await this.getAll();
    return all.find(t => t.address.toLowerCase() === address.toLowerCase());
  },

  // Валидация адреса TON
  isValidAddress(address) {
    if (!address) return false;
    const trimmed = address.trim();
    // Формат: EQ... или UQ... , 48 символов base64url
    return /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(trimmed);
  }
};