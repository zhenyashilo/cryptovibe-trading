const Router = {
  routes: {},
  currentRoute: null,
  currentParams: {},

  register(path, handler) {
    this.routes[path] = handler;
  },

  parseHash() {
    const hash = window.location.hash || '#/portfolio';
    const parts = hash.slice(1).split('/');
    const path = '#/' + parts[1];
    const params = parts.slice(2);
    return { path, params };
  },

  navigate(path) {
    window.location.hash = path;
  },

  resolve() {
    const { path, params } = this.parseHash();
    const handler = this.routes[path] || this.routes['#/portfolio'];
    
    this.currentRoute = path;
    this.currentParams = params;
    
    document.querySelectorAll('[data-route]').forEach(link => {
      const routeName = path.replace('#/', '');
      link.classList.toggle('active', link.dataset.route === routeName);
    });

    window.scrollTo(0, 0);
    if (handler) handler(params);
  },

  init() {
    window.addEventListener('hashchange', () => this.resolve());
    if (!window.location.hash) {
      window.location.hash = '#/portfolio';
    } else {
      this.resolve();
    }
  }
};