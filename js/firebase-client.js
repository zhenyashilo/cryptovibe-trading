// Firebase конфигурация
const firebaseConfig = {
  apiKey: "AIzaSyBYP0lCrTJzeh_7ERYdqGVwAfpkkOiff24",
  authDomain: "cryptovibe-trading.firebaseapp.com",
  projectId: "cryptovibe-trading",
  storageBucket: "cryptovibe-trading.firebasestorage.app",
  messagingSenderId: "415915114461",
  appId: "1:415915114461:web:a327dae9ee8da240bb8034",
  measurementId: "G-CSS9SGCJ2V"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const FirebaseClient = {
  currentUser: null,
  authReadyCallbacks: [],
  authReady: false,

  async init() {
    console.log('🔐 FirebaseClient.init() вызван');
    
    return new Promise((resolve) => {
      // Если уже авторизован — сразу возвращаем
      if (this.currentUser && this.authReady) {
        console.log('✅ Уже авторизован:', this.currentUser.email);
        resolve();
        return;
      }

      auth.onAuthStateChanged((user) => {
        console.log('📡 onAuthStateChanged:', user ? user.email : 'нет пользователя');
        this.currentUser = user;
        
        if (!this.authReady) {
          this.authReady = true;
          this.authReadyCallbacks.forEach(cb => cb(user));
          this.authReadyCallbacks = [];
        }
        
        resolve();
      });
    });
  },

  onAuthReady(callback) {
    if (this.authReady) {
      callback(this.currentUser);
    } else {
      this.authReadyCallbacks.push(callback);
    }
  },

  async migrateTokensFromLocalStorage() {
    if (!this.currentUser) return;
    const localData = localStorage.getItem('ston_tokens');
    if (!localData) return;
    try {
      const localTokens = JSON.parse(localData);
      if (!Array.isArray(localTokens) || localTokens.length === 0) return;
      console.log('🔄 Миграция ' + localTokens.length + ' токенов в Firebase...');
      const existingSnapshot = await db.collection('ston_tokens').where('userId', '==', this.currentUser.uid).get();
      if (existingSnapshot.docs.length > 0) {
        console.log('✅ Токены уже в Firebase');
        localStorage.removeItem('ston_tokens');
        return;
      }
      for (const token of localTokens) {
        await db.collection('ston_tokens').add({
          ...token,
          userId: this.currentUser.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      console.log('✅ Миграция завершена');
      localStorage.removeItem('ston_tokens');
    } catch (err) {
      console.error('❌ Ошибка миграции:', err);
    }
  },

  async getTrades() {
    if (!this.currentUser) {
      console.error('❌ getTrades: нет авторизации');
      return [];
    }
    try {
      console.log('📥 Загрузка транзакций...');
      const snapshot = await db.collection('trades')
        .where('userId', '==', this.currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
      console.log('✅ Загружено', snapshot.docs.length, 'транзакций');
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error('❌ getTrades error:', err);
      return [];
    }
  },

  async addTrade(trade) {
    if (!this.currentUser) {
      console.error('❌ addTrade: нет авторизации');
      throw new Error('Not authenticated');
    }
    try {
      console.log('📤 Добавление транзакции:', trade.name || trade.token);
      const docRef = await db.collection('trades').add({
        ...trade,
        userId: this.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Транзакция добавлена, ID:', docRef.id);
      return { id: docRef.id, ...trade };
    } catch (err) {
      console.error('❌ addTrade error:', err);
      throw err;
    }
  },

  async updateTrade(id, trade) {
    if (!this.currentUser) {
      console.error('❌ updateTrade: нет авторизации');
      throw new Error('Not authenticated');
    }
    try {
      console.log('✏️ Обновление транзакции:', id);
      await db.collection('trades').doc(id).set({
        ...trade,
        userId: this.currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log('✅ Транзакция обновлена');
      return { id, ...trade };
    } catch (err) {
      console.error('❌ updateTrade error:', err);
      throw err;
    }
  },

  async deleteTrade(id) {
    if (!this.currentUser) {
      console.error('❌ deleteTrade: нет авторизации');
      throw new Error('Not authenticated');
    }
    try {
      console.log('🗑️ Удаление транзакции:', id);
      await db.collection('trades').doc(id).delete();
      console.log('✅ Транзакция удалена');
    } catch (err) {
      console.error('❌ deleteTrade error:', err);
      throw err;
    }
  },

  async getPlans() {
    if (!this.currentUser) return [];
    const snapshot = await db.collection('plans')
      .where('userId', '==', this.currentUser.uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addPlan(plan) {
    if (!this.currentUser) throw new Error('Not authenticated');
    const docRef = await db.collection('plans').add({
      ...plan,
      userId: this.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...plan };
  },

  async updatePlan(id, plan) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('plans').doc(id).set({
      ...plan,
      userId: this.currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { id, ...plan };
  },

  async deletePlan(id) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('plans').doc(id).delete();
  },

  async getDiary() {
    if (!this.currentUser) return [];
    const snapshot = await db.collection('diary')
      .where('userId', '==', this.currentUser.uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addDiary(entry) {
    if (!this.currentUser) throw new Error('Not authenticated');
    const docRef = await db.collection('diary').add({
      ...entry,
      userId: this.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...entry };
  },

  async updateDiary(id, entry) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('diary').doc(id).set({
      ...entry,
      userId: this.currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { id, ...entry };
  },

  async deleteDiary(id) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('diary').doc(id).delete();
  },

  async getSettings() {
    if (!this.currentUser) return null;
    const doc = await db.collection('settings').doc(this.currentUser.uid).get();
    return doc.exists ? doc.data() : null;
  },

  async saveSettings(settings) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('settings').doc(this.currentUser.uid).set({
      ...settings,
      userId: this.currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  getCurrentUser() { return this.currentUser; },
  isAuthenticated() { return this.currentUser !== null; },
  async signUp(email, password) { return (await auth.createUserWithEmailAndPassword(email, password)).user; },
  async signIn(email, password) { return (await auth.signInWithEmailAndPassword(email, password)).user; },
  async signOut() { await auth.signOut(); }
};
