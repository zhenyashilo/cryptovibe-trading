// Модуль управления токенами STON.fi
// Синхронизация через Firebase с отладкой

const TokensRegistry = {
  useFirebase: false,
  initialized: false,

  async init() {
    if (this.initialized) {
      console.log('🔍 TokensRegistry already initialized, useFirebase:', this.useFirebase);
      return;
    }
    
    console.log('🔍 TokensRegistry.init() started');
    console.log('🔍 FirebaseClient available:', typeof FirebaseClient !== 'undefined');
    
    if (typeof FirebaseClient !== 'undefined') {
      console.log('🔍 Calling FirebaseClient.init()...');
      await FirebaseClient.init();
      console.log('🔍 FirebaseClient.currentUser after init:', FirebaseClient.currentUser);
      console.log('🔍 FirebaseClient.isAuthenticated():', FirebaseClient.isAuthenticated());
      
      if (FirebaseClient.currentUser !== null) {
        this.useFirebase = true;
        console.log('✅ TokensRegistry: Using Firebase, userId:', FirebaseClient.currentUser.uid);
      } else {
        this.useFirebase = false;
        console.log('⚠️ TokensRegistry: No user, using localStorage');
      }
    } else {
      this.useFirebase = false;
      console.log('⚠️ TokensRegistry: Firebase not available, using localStorage');
    }
    
    this.initialized = true;
  },

  async getAll() {
    await this.init();
    console.log('🔍 TokensRegistry.getAll() called, useFirebase:', this.useFirebase);
    
    if (this.useFirebase) {
      try {
        const snapshot = await firebase.firestore().collection('ston_tokens')
          .where('userId', '==', FirebaseClient.currentUser.uid)
          .get();
        console.log('🔍 Firestore query result:', snapshot.docs.length, 'documents');
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('❌ TokensRegistry.getAll() error:', err);
        return [];
      }
    } else {
      const data = localStorage.getItem('ston_tokens');
      console.log('🔍 localStorage result:', data ? JSON.parse(data).length : 0, 'tokens');
      return data ? JSON.parse(data) : [];
    }
  },

  async add(token) {
    await this.init();
    console.log('🔍 TokensRegistry.add() called, useFirebase:', this.useFirebase);
    
    if (this.useFirebase) {
      try {
        const docRef = await firebase.firestore().collection('ston_tokens').add({
          ...token,
          userId: FirebaseClient.currentUser.uid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Token added to Firestore, id:', docRef.id);
        return { id: docRef.id, ...token };
      } catch (err) {
        console.error('❌ TokensRegistry.add() error:', err);
        throw err;
      }
    } else {
      const tokens = await this.getAll();
      const newToken = { 
        ...token, 
        id: token.id || crypto.randomUUID(), 
        createdAt: Date.now() 
      };
      tokens.push(newToken);
      localStorage.setItem('ston_tokens', JSON.stringify(tokens));
      console.log('✅ Token added to localStorage');
      return newToken;
    }
  },

  async update(token) {
    await this.init();
    
    if (this.useFirebase) {
      try {
        await firebase.firestore().collection('ston_tokens').doc(token.id).update({
          ...token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Token updated in Firestore');
        return token;
      } catch (err) {
        console.error('❌ TokensRegistry.update() error:', err);
        throw err;
      }
    } else {
      const tokens = await this.getAll();
      const idx = tokens.findIndex(t => t.id === token.id);
      if (idx !== -1) {
        tokens[idx] = token;
        localStorage.setItem('ston_tokens', JSON.stringify(tokens));
      }
      return token;
    }
  },

  async delete(id) {
    await this.init();
    
    if (this.useFirebase) {
      try {
        await firebase.firestore().collection('ston_tokens').doc(id).delete();
        console.log('✅ Token deleted from Firestore');
      } catch (err) {
        console.error('❌ TokensRegistry.delete() error:', err);
        throw err;
      }
    } else {
      const tokens = await this.getAll();
      const filtered = tokens.filter(t => t.id !== id);
      localStorage.setItem('ston_tokens', JSON.stringify(filtered));
    }
  },

  async getByAddress(address) {
    const all = await this.getAll();
    return all.find(t => t.address.toLowerCase() === address.toLowerCase());
  },

  isValidAddress(address) {
    if (!address) return false;
    const trimmed = address.trim();
    return /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(trimmed);
  }
};
