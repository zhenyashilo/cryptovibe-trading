const TradingDB = {
  useFirebase: false,

  async init() {
    if (typeof FirebaseClient !== 'undefined') {
      await FirebaseClient.init();
      if (FirebaseClient.isAuthenticated()) {
        this.useFirebase = true;
        console.log('Using Firebase');
        return;
      }
    }
    this.useFirebase = false;
    console.log('Using localStorage (guest mode)');
  },

  async getAll() {
    if (this.useFirebase) return await FirebaseClient.getTrades();
    const data = localStorage.getItem('trades');
    return data ? JSON.parse(data) : [];
  },

  async add(trade) {
    if (this.useFirebase) return await FirebaseClient.addTrade(trade);
    const trades = await this.getAll();
    trades.push(trade);
    localStorage.setItem('trades', JSON.stringify(trades));
    return trade;
  },

  async update(trade) {
    if (this.useFirebase) return await FirebaseClient.updateTrade(trade.id, trade);
    const trades = await this.getAll();
    const idx = trades.findIndex(t => t.id === trade.id);
    if (idx !== -1) trades[idx] = trade;
    localStorage.setItem('trades', JSON.stringify(trades));
    return trade;
  },

  async delete(id) {
    if (this.useFirebase) return await FirebaseClient.deleteTrade(id);
    const trades = await this.getAll();
    localStorage.setItem('trades', JSON.stringify(trades.filter(t => t.id !== id)));
  },

  async getAllPlans() {
    if (this.useFirebase) return await FirebaseClient.getPlans();
    const data = localStorage.getItem('plans');
    return data ? JSON.parse(data) : [];
  },

  async addPlan(plan) {
    if (this.useFirebase) return await FirebaseClient.addPlan(plan);
    const plans = await this.getAllPlans();
    plans.push(plan);
    localStorage.setItem('plans', JSON.stringify(plans));
    return plan;
  },

  async updatePlan(plan) {
    if (this.useFirebase) return await FirebaseClient.updatePlan(plan.id, plan);
    const plans = await this.getAllPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx !== -1) plans[idx] = plan;
    localStorage.setItem('plans', JSON.stringify(plans));
    return plan;
  },

  async deletePlan(id) {
    if (this.useFirebase) return await FirebaseClient.deletePlan(id);
    const plans = await this.getAllPlans();
    localStorage.setItem('plans', JSON.stringify(plans.filter(p => p.id !== id)));
  },

  async getAllDiary() {
    if (this.useFirebase) return await FirebaseClient.getDiary();
    const data = localStorage.getItem('diary');
    return data ? JSON.parse(data) : [];
  },

  async addDiary(entry) {
    if (this.useFirebase) return await FirebaseClient.addDiary(entry);
    const diary = await this.getAllDiary();
    diary.push(entry);
    localStorage.setItem('diary', JSON.stringify(diary));
    return entry;
  },

  async updateDiary(entry) {
    if (this.useFirebase) return await FirebaseClient.updateDiary(entry.id, entry);
    const diary = await this.getAllDiary();
    const idx = diary.findIndex(d => d.id === entry.id);
    if (idx !== -1) diary[idx] = entry;
    localStorage.setItem('diary', JSON.stringify(diary));
    return entry;
  },

  async deleteDiary(id) {
    if (this.useFirebase) return await FirebaseClient.deleteDiary(id);
    const diary = await this.getAllDiary();
    localStorage.setItem('diary', JSON.stringify(diary.filter(d => d.id !== id)));
  },

  async getSetting(key) {
    if (this.useFirebase) {
      const settings = await FirebaseClient.getSettings();
      return settings ? settings[key] : 0;
    }
    const data = localStorage.getItem('settings');
    const settings = data ? JSON.parse(data) : {};
    return settings[key] || 0;
  },

  async saveSetting(key, value) {
    if (this.useFirebase) {
      const settings = await FirebaseClient.getSettings() || {};
      settings[key] = value;
      await FirebaseClient.saveSettings(settings);
    } else {
      const data = localStorage.getItem('settings');
      const settings = data ? JSON.parse(data) : {};
      settings[key] = value;
      localStorage.setItem('settings', JSON.stringify(settings));
    }
  }
};
