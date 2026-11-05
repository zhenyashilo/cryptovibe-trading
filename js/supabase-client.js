// Подключение к Supabase
const SUPABASE_URL = 'https://htevorspryqgjttupldna.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BaQCryXD7J060WJRm_qUDw_blk7892C';

// Инициализация Supabase клиента
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Модуль для работы с Supabase
const SupabaseClient = {
  // Текущий пользователь
  currentUser: null,

  // Инициализация
  async init() {
    // Проверяем текущую сессию
    const { data: { session } } = await supabase.auth.getSession();
    this.currentUser = session?.user || null;
    
    // Подписываемся на изменения авторизации
    supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      console.log('Auth state changed:', event, this.currentUser);
      
      // Перезагружаем страницу при изменении авторизации
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        window.location.reload();
      }
    });
    
    console.log('Supabase initialized');
  },

  // Авторизация
  async signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // CRUD операции для trades
  async getTrades() {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addTrade(trade) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('trades')
      .insert([{ ...trade, user_id: this.currentUser.id }])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async updateTrade(trade) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('trades')
      .update(trade)
      .eq('id', trade.id)
      .eq('user_id', this.currentUser.id)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async deleteTrade(id) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('user_id', this.currentUser.id);
    
    if (error) throw error;
  },

  // CRUD операции для plans
  async getPlans() {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addPlan(plan) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('plans')
      .insert([{ ...plan, user_id: this.currentUser.id }])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async updatePlan(plan) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('plans')
      .update(plan)
      .eq('id', plan.id)
      .eq('user_id', this.currentUser.id)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async deletePlan(id) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('plans')
      .delete()
      .eq('id', id)
      .eq('user_id', this.currentUser.id);
    
    if (error) throw error;
  },

  // CRUD операции для diary
  async getDiary() {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('diary')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async addDiary(entry) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('diary')
      .insert([{ ...entry, user_id: this.currentUser.id }])
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async updateDiary(entry) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('diary')
      .update(entry)
      .eq('id', entry.id)
      .eq('user_id', this.currentUser.id)
      .select();
    
    if (error) throw error;
    return data[0];
  },

  async deleteDiary(id) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('diary')
      .delete()
      .eq('id', id)
      .eq('user_id', this.currentUser.id);
    
    if (error) throw error;
  },

  // CRUD операции для settings
  async getSettings() {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  async saveSettings(settings) {
    if (!this.currentUser) throw new Error('Not authenticated');
    
    // Проверяем есть ли уже настройки
    const existing = await this.getSettings();
    
    if (existing) {
      // Обновляем
      const { data, error } = await supabase
        .from('settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('user_id', this.currentUser.id)
        .select();
      
      if (error) throw error;
      return data[0];
    } else {
      // Создаём
      const { data, error } = await supabase
        .from('settings')
        .insert([{ ...settings, user_id: this.currentUser.id }])
        .select();
      
      if (error) throw error;
      return data[0];
    }
  },

  // Получение текущего пользователя
  getCurrentUser() {
    return this.currentUser;
  },

  // Проверка авторизации
  isAuthenticated() {
    return this.currentUser !== null;
  }
};

// Экспортируем для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseClient;
}