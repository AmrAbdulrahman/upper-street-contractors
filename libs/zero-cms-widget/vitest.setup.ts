// jsdom lacks several browser globals that @dnd-kit/dom instantiates at module
// load / during drag. Provide inert polyfills so specs importing the field
// registry (which pulls @dnd-kit) can run under jsdom.

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const g = globalThis as unknown as Record<string, unknown>;
g.ResizeObserver ??= ResizeObserverStub;
g.IntersectionObserver ??= IntersectionObserverStub;
