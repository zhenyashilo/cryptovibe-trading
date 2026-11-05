const TradingDB = {
  DB_NAME: 'CryptoVibeTrading',
  DB_VERSION: 4, // Увеличили для store diary
  STORE_NAME: 'trades',
  PLANS_STORE: 'plans',
  DIARY_STORE: 'diary',
  SETTINGS_STORE: 'settings',
  
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.db = request.result; console.log('TradingDB инициализирована'); resolve(); };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          console.log('Создан store: trades');
        }
        if (!db.objectStoreNames.contains(this.PLANS_STORE)) {
          const s = db.createObjectStore(this.PLANS_STORE, { keyPath: 'id' });
          s.createIndex('status', 'status', { unique: false });
          console.log('Создан store: plans');
        }
        if (!db.objectStoreNames.contains(this.DIARY_STORE)) {
          const s = db.createObjectStore(this.DIARY_STORE, { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
          console.log('Создан store: diary');
        }
        if (!db.objectStoreNames.contains(this.SETTINGS_STORE)) {
          db.createObjectStore(this.SETTINGS_STORE, { keyPath: 'key' });
          console.log('Создан store: settings');
        }
      };
    });
  },

  async getAll() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.STORE_NAME], 'readonly');
      const req = tx.objectStore(this.STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async add(t) { return new Promise((r,j) => { const tx = this.db.transaction([this.STORE_NAME],'readwrite'); const req = tx.objectStore(this.STORE_NAME).add(t); req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error); }); },
  async update(t) { return new Promise((r,j) => { const tx = this.db.transaction([this.STORE_NAME],'readwrite'); const req = tx.objectStore(this.STORE_NAME).put(t); req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error); }); },
  async delete(id) { return new Promise((r,j) => { const tx = this.db.transaction([this.STORE_NAME],'readwrite'); const req = tx.objectStore(this.STORE_NAME).delete(id); req.onsuccess=()=>r(); req.onerror=()=>j(req.error); }); },

  async getAllPlans() { return new Promise((r,j) => { const tx = this.db.transaction([this.PLANS_STORE],'readonly'); const req = tx.objectStore(this.PLANS_STORE).getAll(); req.onsuccess=()=>r(req.result||[]); req.onerror=()=>j(req.error); }); },
  async addPlan(p) { return new Promise((r,j) => { const tx = this.db.transaction([this.PLANS_STORE],'readwrite'); const req = tx.objectStore(this.PLANS_STORE).add(p); req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error); }); },
  async updatePlan(p) { return new Promise((r,j) => { const tx = this.db.transaction([this.PLANS_STORE],'readwrite'); const req = tx.objectStore(this.PLANS_STORE).put(p); req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error); }); },
  async deletePlan(id) { return new Promise((r,j) => { const tx = this.db.transaction([this.PLANS_STORE],'readwrite'); const req = tx.objectStore(this.PLANS_STORE).delete(id); req.onsuccess=()=>r(); req.onerror=()=>j(req.error); }); },

  async getAllDiary() { return new Promise((r,j) => { const tx = this.db.transaction([this.DIARY_STORE],'readonly'); const req = tx.objectStore(this.DIARY_STORE).getAll(); req.onsuccess=()=>r(req.result||[]); req.onerror=()=>j(req.error); }); },
  async addDiary(d) { return new Promise((r,j) => { const tx = this.db.transaction([this.DIARY_STORE],'readwrite'); const req = tx.objectStore(this.DIARY_STORE).add(d); req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error); }); },
  async updateDiary(d) { return new Promise((r,j) => { const tx = this.db.transaction([this.DIARY_STORE],'readwrite'); const req = tx.objectStore(this.DIARY_STORE).put(d); req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error); }); },
  async deleteDiary(id) { return new Promise((r,j) => { const tx = this.db.transaction([this.DIARY_STORE],'readwrite'); const req = tx.objectStore(this.DIARY_STORE).delete(id); req.onsuccess=()=>r(); req.onerror=()=>j(req.error); }); },

  async getSetting(key) {
    return new Promise((resolve) => {
      try {
        if (!this.db.objectStoreNames.contains(this.SETTINGS_STORE)) { resolve(0); return; }
        const tx = this.db.transaction([this.SETTINGS_STORE], 'readonly');
        const req = tx.objectStore(this.SETTINGS_STORE).get(key);
        req.onsuccess = () => resolve(req.result?.value || 0);
        req.onerror = () => resolve(0);
      } catch (e) { resolve(0); }
    });
  },
  async saveSetting(key, value) {
    return new Promise((resolve) => {
      try {
        if (!this.db.objectStoreNames.contains(this.SETTINGS_STORE)) { resolve(); return; }
        const tx = this.db.transaction([this.SETTINGS_STORE], 'readwrite');
        const req = tx.objectStore(this.SETTINGS_STORE).put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (e) { resolve(); }
    });
  }
};