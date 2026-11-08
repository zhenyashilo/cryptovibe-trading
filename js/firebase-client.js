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
  initialized: false,

  async init() {
    if (this.initialized) return;
    
    // Используем authStateReady() — ждёт пока Firebase определит авторизацию
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
      this.currentUser = auth.currentUser;
    } else {
      // Fallback для старых версий
      await new Promise((resolve) => {
        auth.onAuthStateChanged((user) => {
          this.currentUser = user;
          resolve();
        });
      });
    }
    
    this.initialized = true;
    console.log('✅ FirebaseClient initialized:', this.currentUser ? this.currentUser.email : 'No user');
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
