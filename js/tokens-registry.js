// Модуль управления токенами STON.fi
// Синхронизация через Firebase

const TokensRegistry = {
  useFirebase: false,

  async init() {
    if (typeof FirebaseClient !== 'undefined') {
      await FirebaseClient.init();
      if (FirebaseClient.isAuthenticated()) {
        this.useFirebase = true;
        console.log('TokensRegistry: Using Firebase');
        return;
      }
    }
    this.useFirebase = false;
    console.log('TokensRegistry: Using localStorage (guest mode)');
  },

  async getAll() {
    await this.init();
    
    if (this.useFirebase) {
      const snapshot = await firebase.firestore().collection('ston_tokens')
        .where('userId', '==', FirebaseClient.currentUser.uid)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      const data = localStorage.getItem('ston_tokens');
      return data ? JSON.parse(data) : [];
    }
  },

  async add(token) {
    await this.init();
    
    if (this.useFirebase) {
      const docRef = await firebase.firestore().collection('ston_tokens').add({
        ...token,
        userId: FirebaseClient.currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { id: docRef.id, ...token };
    } else {
      const tokens = await this.getAll();
      const newToken = { 
        ...token, 
        id: token.id || crypto.randomUUID(), 
        createdAt: Date.now() 
      };
      tokens.push(newToken);
      localStorage.setItem('ston_tokens', JSON.stringify(tokens));
      return newToken;
    }
  },

  async update(token) {
    await this.init();
    
    if (this.useFirebase) {
      await firebase.firestore().collection('ston_tokens').doc(token.id).update({
        ...token,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return token;
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
      await firebase.firestore().collection('ston_tokens').doc(id).delete();
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
