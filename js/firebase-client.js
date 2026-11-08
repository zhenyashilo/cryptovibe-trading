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

// Модуль для работы с Firebase
const FirebaseClient = {
  currentUser: null,
  authReadyCallbacks: [],
  authReady: false,

  async init() {
    return new Promise((resolve) => {
      auth.onAuthStateChanged((user) => {
        this.currentUser = user;
        console.log('Auth state changed:', user ? user.email : 'No user');
        
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
      
      console.log('🔄 Миграция ' + localTokens.length + ' токенов из localStorage в Firebase...');
      
      const existingSnapshot = await db.collection('ston_tokens')
        .where('userId', '==', this.currentUser.uid)
        .get();
      
      if (existingSnapshot.docs.length > 0) {
        console.log('✅ Токены уже есть в Firebase, пропускаем миграцию');
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
      console.error('Ошибка миграции:', err);
    }
  },

  async signUp(email, password) {
    const { user } = await auth.createUserWithEmailAndPassword(email, password);
    return user;
  },

  async signIn(email, password) {
    const { user } = await auth.signInWithEmailAndPassword(email, password);
    return user;
  },

  async signOut() {
    await auth.signOut();
  },

  async getTrades() {
    if (!this.currentUser) return [];
    const snapshot = await db.collection('trades')
      .where('userId', '==', this.currentUser.uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addTrade(trade) {
    if (!this.currentUser) throw new Error('Not authenticated');
    const docRef = await db.collection('trades').add({
      ...trade,
      userId: this.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: docRef.id, ...trade };
  },

  async updateTrade(id, trade) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('trades').doc(id).update({
      ...trade,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id, ...trade };
  },

  async deleteTrade(id) {
    if (!this.currentUser) throw new Error('Not authenticated');
    await db.collection('trades').doc(id).delete();
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
    await db.collection('plans').doc(id).update({
      ...plan,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
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
    await db.collection('diary').doc(id).update({
      ...entry,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
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

  getCurrentUser() {
    return this.currentUser;
  },

  isAuthenticated() {
    return this.currentUser !== null;
  }
};