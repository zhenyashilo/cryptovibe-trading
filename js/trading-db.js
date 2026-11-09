// TradingDB - работает с Firebase
const TradingDB = {
  DB_NAME: 'CryptoVibeTrading',
  DB_VERSION: 4,
  STORE_NAME: 'trades',
  PLANS_STORE: 'plans',
  DIARY_STORE: 'diary',
  SETTINGS_STORE: 'settings',
  db: null,
  useFirebase: false,

  async init() {
    if (typeof FirebaseClient !== 'undefined') {
      await FirebaseClient.init();
      await new Promise(resolve => FirebaseClient.onAuthReady(() => resolve()));
      
      if (FirebaseClient.isAuthenticated()) {
        this.useFirebase = true;
        console.log('Using Firebase');
        return;
      }
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('TradingDB initialized (IndexedDB)');
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.PLANS_STORE)) {
          const s = db.createObjectStore(this.PLANS_STORE, { keyPath: 'id' });
          s.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.DIARY_STORE)) {
          const s = db.createObjectStore(this.DIARY_STORE, { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains(this.SETTINGS_STORE)) {
          db.createObjectStore(this.SETTINGS_STORE, { keyPath: 'key' });
        }
      };
    });
  },

  async getAll() {
    if (this.useFirebase) {
      return await FirebaseClient.getTrades();
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.STORE_NAME], 'readonly');
        const req = tx.objectStore(this.STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async add(t) {
    if (this.useFirebase) {
      return await FirebaseClient.addTrade(t);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
        const req = tx.objectStore(this.STORE_NAME).add(t);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async update(t) {
    if (this.useFirebase) {
      return await FirebaseClient.updateTrade(t.id, t);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
        const req = tx.objectStore(this.STORE_NAME).put(t);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async delete(id) {
    if (this.useFirebase) {
      return await FirebaseClient.deleteTrade(id);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.STORE_NAME], 'readwrite');
        const req = tx.objectStore(this.STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  },

  async getAllPlans() {
    if (this.useFirebase) {
      return await FirebaseClient.getPlans();
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.PLANS_STORE], 'readonly');
        const req = tx.objectStore(this.PLANS_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async addPlan(p) {
    if (this.useFirebase) {
      return await FirebaseClient.addPlan(p);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.PLANS_STORE], 'readwrite');
        const req = tx.objectStore(this.PLANS_STORE).add(p);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async updatePlan(p) {
    if (this.useFirebase) {
      return await FirebaseClient.updatePlan(p.id, p);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.PLANS_STORE], 'readwrite');
        const req = tx.objectStore(this.PLANS_STORE).put(p);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async deletePlan(id) {
    if (this.useFirebase) {
      return await FirebaseClient.deletePlan(id);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.PLANS_STORE], 'readwrite');
        const req = tx.objectStore(this.PLANS_STORE).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  },

  async getAllDiary() {
    if (this.useFirebase) {
      return await FirebaseClient.getDiary();
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.DIARY_STORE], 'readonly');
        const req = tx.objectStore(this.DIARY_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async addDiary(d) {
    if (this.useFirebase) {
      return await FirebaseClient.addDiary(d);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.DIARY_STORE], 'readwrite');
        const req = tx.objectStore(this.DIARY_STORE).add(d);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async updateDiary(d) {
    if (this.useFirebase) {
      return await FirebaseClient.updateDiary(d.id, d);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.DIARY_STORE], 'readwrite');
        const req = tx.objectStore(this.DIARY_STORE).put(d);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  },

  async deleteDiary(id) {
    if (this.useFirebase) {
      return await FirebaseClient.deleteDiary(id);
    } else {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction([this.DIARY_STORE], 'readwrite');
        const req = tx.objectStore(this.DIARY_STORE).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  },

  async getSetting(key) {
    if (this.useFirebase) {
      const settings = await FirebaseClient.getSettings();
      if (!settings) return 0;
      return settings[key] || 0;
    } else {
      return new Promise((resolve) => {
        try {
          if (!this.db.objectStoreNames.contains(this.SETTINGS_STORE)) { resolve(0); return; }
          const tx = this.db.transaction([this.SETTINGS_STORE], 'readonly');
          const req = tx.objectStore(this.SETTINGS_STORE).get(key);
          req.onsuccess = () => resolve(req.result?.value || 0);
          req.onerror = () => resolve(0);
        } catch (e) { resolve(0); }
      });
    }
  },

  async saveSetting(key, value) {
    if (this.useFirebase) {
      const settings = await FirebaseClient.getSettings() || {};
      settings[key] = value;
      await FirebaseClient.saveSettings(settings);
    } else {
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
  }
};
