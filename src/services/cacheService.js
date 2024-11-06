const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 9 * 1024 * 1024; // 约 9MB，留有余地

export const cacheService = {
  setData(key, data) {
    const cacheItem = {
      data,
      timestamp: new Date().getTime()
    };
    try {
      const serializedItem = JSON.stringify(cacheItem);
      if (serializedItem.length * 2 > MAX_CACHE_SIZE) {
        console.warn('Cache item too large, not caching:', key);
        return;
      }
      localStorage.setItem(key, serializedItem);
      this.cleanCache();
    } catch (e) {
      console.error('Error setting cache:', e);
      this.clearOldestCache();
    }
  },

  getData(key) {
    const cachedItem = localStorage.getItem(key);
    if (!cachedItem) return null;

    try {
      const { data, timestamp } = JSON.parse(cachedItem);
      const now = new Date().getTime();

      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (e) {
      console.error('Error getting cache:', e);
      return null;
    }
  },

  clearCache(key) {
    if (key) {
      localStorage.removeItem(key);
    } else {
      localStorage.clear();
    }
  },

  cleanCache() {
    const now = new Date().getTime();
    let totalSize = 0;
    const cacheItems = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const item = localStorage.getItem(key);
      totalSize += item.length * 2; // 估算字节大小

      try {
        const { timestamp } = JSON.parse(item);
        cacheItems.push({ key, timestamp, size: item.length * 2 });
      } catch (e) {
        console.error('Error parsing cache item:', e);
      }
    }

    if (totalSize > MAX_CACHE_SIZE) {
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      while (totalSize > MAX_CACHE_SIZE && cacheItems.length) {
        const oldestItem = cacheItems.shift();
        localStorage.removeItem(oldestItem.key);
        totalSize -= oldestItem.size;
      }
    }
  },

  clearOldestCache() {
    let oldestKey = null;
    let oldestTimestamp = Infinity;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        const { timestamp } = JSON.parse(localStorage.getItem(key));
        if (timestamp < oldestTimestamp) {
          oldestTimestamp = timestamp;
          oldestKey = key;
        }
      } catch (e) {
        console.error('Error parsing cache item:', e);
      }
    }

    if (oldestKey) {
      localStorage.removeItem(oldestKey);
    }
  }
};