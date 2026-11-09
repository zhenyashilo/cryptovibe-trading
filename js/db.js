const DB_NAME = 'CryptoVibeDB';
const DB_VERSION = 4;
const STORE_TX = 'transactions';
const STORE_TYPES = 'operationTypes';

let dbInstance = null;

const dbPromise = new Promise((resolve, reject) => {
  try {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(STORE_TX)) {
        const store = db.createObjectStore(STORE_TX, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORE_TYPES)) {
        db.createObjectStore(STORE_TYPES, { keyPath: 'key' });
      }
      
      if (!db.objectStoreNames.contains('stonTokens')) {
        const store = db.createObjectStore('stonTokens', { keyPath: 'id' });
        store.createIndex('address', 'address', { unique: true });
        store.createIndex('name', 'name', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('alerts')) {
        const store = db.createObjectStore('alerts', { keyPath: 'tokenAddress' });
        store.createIndex('tokenAddress', 'tokenAddress', { unique: true });
      }
    };
  } catch (err) {
    reject(err);
  }
});

const DB = {
  // Вспомогательный метод: проверяем, можно ли использовать облако
  async _useFirebase() {
    return typeof FirebaseClient !== 'undefined' && FirebaseClient.isAuthenticated();
  },

  async add(tx) {
    if (await this._useFirebase()) {
      return await FirebaseClient.addTrade(tx); // === СОХРАНЯЕМ В ОБЛАКО ===
    }
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TX, 'readwrite');
      const store = transaction.objectStore(STORE_TX);
      const request = store.add(tx);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async update(tx) {
    if (await this._useFirebase()) {
      return await FirebaseClient.updateTrade(tx.id, tx); // === ОБНОВЛЯЕМ В ОБЛАКЕ ===
    }
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TX, 'readwrite');
      const store = transaction.objectStore(STORE_TX);
      const request = store.put(tx);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  async delete(id) {
    if (await this._useFirebase()) {
      return await FirebaseClient.deleteTrade(id); // === УДАЛЯЕМ ИЗ ОБЛАКА ===
    }
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TX, 'readwrite');
      const store = transaction.objectStore(STORE_TX);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  
  async getAll() {
    if (await this._useFirebase()) {
      return await FirebaseClient.getTrades(); // === ЧИТАЕМ ИЗ ОБЛАКА ===
    }
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TX, 'readonly');
      const store = transaction.objectStore(STORE_TX);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getTypes() {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TYPES, 'readonly');
      const store = transaction.objectStore(STORE_TYPES);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async addType(typeObj) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TYPES, 'readwrite');
      const store = transaction.objectStore(STORE_TYPES);
      const request = store.put(typeObj);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteType(key) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_TYPES, 'readwrite');
      const store = transaction.objectStore(STORE_TYPES);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
