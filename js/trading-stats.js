// Расчёт статистики трейдинга (оптимизировано)

const TradingStats = {
  _cache: null,
  _cacheKey: '',

  calculate(trades, initialDeposit = 0) {
    // Кэширование результатов
    const cacheKey = `${trades.length}-${initialDeposit}`;
    if (this._cache && this._cacheKey === cacheKey) {
      return this._cache;
    }

    if (trades.length === 0) {
      const result = {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalLoss: 0,
        netProfit: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        currentBalance: initialDeposit
      };
      this._cache = result;
      this._cacheKey = cacheKey;
      return result;
    }

    let totalProfit = 0;
    let totalLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    // Один проход вместо нескольких
    for (let i = 0; i < trades.length; i++) {
      const pnl = this.calculatePnL(trades[i]);
      
      if (pnl > 0) {
        totalProfit += pnl;
        winningTrades++;
      } else if (pnl < 0) {
        totalLoss += Math.abs(pnl);
        losingTrades++;
      }
    }

    const totalTrades = trades.length;
    const winRate = (winningTrades / totalTrades) * 100;
    const netProfit = totalProfit - totalLoss;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? totalProfit : 0);
    const averageWin = winningTrades > 0 ? totalProfit / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLoss / losingTrades : 0;
    const currentBalance = initialDeposit + netProfit;

    const result = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      totalProfit,
      totalLoss,
      netProfit,
      profitFactor,
      averageWin,
      averageLoss,
      currentBalance
    };

    this._cache = result;
    this._cacheKey = cacheKey;
    return result;
  },

  calculatePnL(trade) {
    const entry = parseFloat(trade.entryPrice) || 0;
    const exit = parseFloat(trade.exitPrice) || 0;
    const quantity = parseFloat(trade.quantity) || 0;
    const fee = parseFloat(trade.fee) || 0;

    return (exit - entry) * quantity - fee;
  },

  formatMoney(amount) {
    const sign = amount >= 0 ? '+' : '-';
    return sign + '$' + Math.abs(amount).toFixed(2);
  },

  formatPercent(percent) {
    return percent.toFixed(2) + '%';
  },

  clearCache() {
    this._cache = null;
    this._cacheKey = '';
  }
};