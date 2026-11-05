// Прокси для обхода CORS ограничений
const ProxyAPI = {
  // Публичные CORS прокси (с fallback)
  PROXIES: [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ],

  async fetchWithProxy(url, options = {}) {
    // Сначала пробуем прямой запрос (может сработать для некоторых API)
    try {
      const response = await fetch(url, {
        ...options,
        mode: 'cors'
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.log('Прямой запрос не удался, используем прокси');
    }

    // Пробуем прокси по очереди
    for (const proxyFn of this.PROXIES) {
      try {
        const proxyUrl = proxyFn(url);
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            return text;
          }
        }
      } catch (e) {
        console.log('Прокси не сработал:', proxyFn.toString().split('`')[1]?.split('`')[0]);
      }
    }

    throw new Error('Все прокси не сработали');
  },

  async fetchText(url) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.text();
    } catch (e) {}

    for (const proxyFn of this.PROXIES) {
      try {
        const proxyUrl = proxyFn(url);
        const response = await fetch(proxyUrl);
        if (response.ok) return await response.text();
      } catch (e) {}
    }
    return null;
  }
};