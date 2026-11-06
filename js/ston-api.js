// API цен через DexScreener (без CORS проблем)

const StonAPI = {
  _cache: new Map(),
  CACHE_TTL: 15 * 60 * 1000,
  
  USDT_ADDRESS: 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA',
  
  STORAGE_KEY: 'stonapi_last_prices',
  STORAGE_TTL_KEY: 'stonapi_last_prices_time',
  STORAGE_TTL: 60 * 60 * 1000,

  _loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const time = localStorage.getItem(this.STORAGE_TTL_KEY);
      if (data && time && (Date.now() - parseInt(time)) < this.STORAGE_TTL) {
        return JSON.parse(data);
      }
    } catch (e) {}
    return {};
  },

  _saveToStorage(prices) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prices));
      localStorage.setItem(this.STORAGE_TTL_KEY, Date.now().toString());
    } catch (e) {}
  },

  getLastKnownPrice(tokenAddress) {
    const memCache = this._cache.get(tokenAddress);
    if (memCache && memCache.price > 0) return memCache;
    
    const storage = this._loadFromStorage();
    if (storage[tokenAddress] && storage[tokenAddress].price > 0) {
      return { ...storage[tokenAddress], fromStorage: true, timestamp: storage[tokenAddress].timestamp || 0 };
    }
    return null;
  },

  async _fetchDexScreener(tokenAddress) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data = await response.json();
      const pairs = data.pairs || [];
      if (pairs.length === 0) return null;
      
      // Ищем пару с USDT или TON
      let bestPair = null;
      for (const pair of pairs) {
        if (pair.chainId === 'ton') {
          const quoteSymbol = (pair.quoteToken?.symbol || '').toUpperCase();
          if (quoteSymbol === 'USDT' || quoteSymbol === 'TON') {
            bestPair = pair;
            break;
          }
        }
      }
      
      if (!bestPair && pairs.length > 0) {
        bestPair = pairs[0];
      }
      
      if (bestPair) {
        const priceUsd = parseFloat(bestPair.priceUsd || '0');
        if (priceUsd > 0) {
          return {
            price: priceUsd,
            dex: bestPair.dexId || 'dexscreener',
            poolName: `${bestPair.baseToken?.symbol}/${bestPair.quoteToken?.symbol}` || '',
            tokenName: bestPair.baseToken?.symbol || null, // ✅ НОВОЕ ПОЛЕ
            priceChange24h: parseFloat(bestPair.priceChange?.h24 || '0'),
            source: 'DexScreener'
          };
        }
      }
    } catch (e) {
      console.log('DexScreener: ошибка', e.message);
    }
    return null;
  },

  async getCurrentPrice(tokenAddress, baseCurrency = 'USDT') {
    const addr = tokenAddress.trim();
    const cacheKey = addr + ':USD';
    
    // Проверяем кэш
    const memCached = this._cache.get(cacheKey);
    if (memCached && (Date.now() - memCached.timestamp) < this.CACHE_TTL) {
      return memCached;
    }
    
    // Получаем цену
    let result = await this._fetchDexScreener(addr);
    
    // Если не получилось — берём из кэша
    if (!result || result.price <= 0) {
      const lastKnown = this.getLastKnownPrice(addr);
      if (lastKnown) {
        console.log(`⚠️ Используем кэш для ${addr.slice(0, 10)}`);
        result = { ...lastKnown, fromStorage: true, available: true };
      } else {
        result = {
          price: null, timestamp: Date.now(), available: false,
          baseCurrency: 'USDT', dex: 'unknown', priceChange24h: 0,
          source: 'none'
        };
      }
    } else {
      console.log(`✅ Цена получена из DexScreener: $${result.price}`);
    }
    
    const finalResult = {
      price: result.price,
      timestamp: Date.now(),
      available: result.price > 0,
      baseCurrency: 'USDT',
      dex: result.dex || 'unknown',
      priceChange24h: result.priceChange24h || 0,
      poolName: result.poolName || '',
      tokenName: result.tokenName || null, // ✅ НОВОЕ ПОЛЕ
      source: result.source || 'unknown',
      fromStorage: result.fromStorage || false
    };
    
    // Сохраняем в кэш
    if (finalResult.available) {
      this._cache.set(cacheKey, finalResult);
      const storage = this._loadFromStorage();
      storage[addr] = {
        price: finalResult.price,
        dex: finalResult.dex,
        poolName: finalResult.poolName,
        tokenName: finalResult.tokenName, // ✅ НОВОЕ ПОЛЕ
        priceChange24h: finalResult.priceChange24h,
        source: finalResult.source,
        timestamp: Date.now()
      };
      this._saveToStorage(storage);
    }
    
    return finalResult;
  },

  async getMultiplePrices(addresses) {
    const results = {};
    for (const addr of addresses) {
      results[addr] = await this.getCurrentPrice(addr, 'USDT');
    }
    return results;
  },

  clearCache() {
    this._cache.clear();
  },

  clearAll() {
    this._cache.clear();
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.STORAGE_TTL_KEY);
    } catch (e) {}
  },

  async getAvailablePools(tokenAddress) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return data.pairs || [];
    } catch (e) {
      console.log('getAvailablePools error:', e.message);
      return [];
    }
  }
};
