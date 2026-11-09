// Модуль управления токенами STON.fi
// Синхронизация через Firebase

const TokensRegistry = {
  
  async _isAuthenticated() {
    if (typeof FirebaseClient !== 'undefined') {
      if (FirebaseClient.currentUser === null && typeof FirebaseClient.init === 'function') {
        await FirebaseClient.init();
      }
      return FirebaseClient.currentUser !== null;
    }
    return false;
  },

  async getAll() {
    if (await this._isAuthenticated()) {
      try {
        const snapshot = await firebase.firestore().collection('ston_tokens')
          .where('userId', '==', FirebaseClient.currentUser.uid)
          .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('TokensRegistry.getAll error:', err);
        return [];
      }
    } else {
      const data = localStorage.getItem('ston_tokens');
      return data ? JSON.parse(data) : [];
    }
  },

  async add(token) {
    if (await this._isAuthenticated()) {
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
    if (await this._isAuthenticated()) {
      try {
        await firebase.firestore().collection('ston_tokens').doc(token.id).set({
          ...token,
          userId: FirebaseClient.currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return token;
      } catch (err) {
        console.error('TokensRegistry.update error:', err);
        if (err.code === 'not-found' || err.message.includes('No document')) {
          const docRef = await firebase.firestore().collection('ston_tokens').add({
            ...token,
            userId: FirebaseClient.currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          return { id: docRef.id, ...token };
        }
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
    if (await this._isAuthenticated()) {
      try {
        await firebase.firestore().collection('ston_tokens').doc(id).delete();
      } catch (err) {
        console.error('TokensRegistry.delete error:', err);
        if (err.code !== 'not-found' && !err.message.includes('No document')) {
          throw err;
        }
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
