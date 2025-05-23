import NodeCache from 'node-cache';
import redis from 'redis';

// Default TTL values in seconds
export const DEFAULT_TTL = {
  MARKET_DATA: 15 * 60,       // 15 minutes for market data
  STOCK_DATA: 60 * 60,        // 1 hour for stock data
  HISTORICAL_DATA: 24 * 60 * 60, // 1 day for historical data
  FINANCIAL_DATA: 24 * 60 * 60   // 1 day for financial statements
};

class CacheService {
  private useRedis: boolean;
  private redisClient: any; // Using any for simplicity, could be properly typed
  private memoryCache: NodeCache = new NodeCache(); // Initialize with default values

  constructor() {
    // Determine if Redis should be used based on environment variable
    this.useRedis = process.env.USE_REDIS === 'true';
    
    // Initialize memoryCache with default settings
    this.memoryCache = new NodeCache({ stdTTL: DEFAULT_TTL.MARKET_DATA, checkperiod: 120 });
    
    if (this.useRedis) {
      try {
        // Initialize Redis client
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.redisClient.on('error', (err: Error) => {
          console.error('Redis Client Error:', err);
          // Fall back to in-memory cache if Redis fails
          console.log('Falling back to in-memory cache...');
          this.useRedis = false;
        });
        
        // Connect to Redis
        this.redisClient.connect().then(() => {
          console.log('Connected to Redis successfully');
        }).catch((err: Error) => {
          console.error('Failed to connect to Redis:', err);
          this.useRedis = false;
        });
        
      } catch (error) {
        console.error('Error initializing Redis:', error);
        this.useRedis = false;
      }
    } else {
      // Using in-memory cache
      console.log('Using in-memory cache');
    }
  }

  /**
   * Get data from cache
   * @param {string} key - The cache key
   * @returns {Promise<any>} - The cached data or null if not found
   */
  async get(key: string): Promise<any> {
    try {
      if (this.useRedis && this.redisClient.isOpen) {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        return this.memoryCache.get(key);
      }
    } catch (error) {
      console.error(`Error retrieving key ${key} from cache:`, error);
      return null;
    }
  }

  /**
   * Set data in cache
   * @param {string} key - The cache key
   * @param {any} value - The data to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async set(key: string, value: any, ttl: number): Promise<boolean> {
    try {
      if (this.useRedis && this.redisClient.isOpen) {
        await this.redisClient.set(key, JSON.stringify(value), { EX: ttl });
      } else {
        this.memoryCache.set(key, value, ttl);
      }
      return true;
    } catch (error) {
      console.error(`Error setting key ${key} in cache:`, error);
      return false;
    }
  }

  /**
   * Delete data from cache
   * @param {string} key - The cache key
   * @returns {Promise<boolean>} - Success status
   */
  async del(key: string): Promise<boolean> {
    try {
      if (this.useRedis && this.redisClient.isOpen) {
        await this.redisClient.del(key);
      } else {
        this.memoryCache.del(key);
      }
      return true;
    } catch (error) {
      console.error(`Error deleting key ${key} from cache:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<boolean>} - Success status
   */
  async flushAll(): Promise<boolean> {
    try {
      if (this.useRedis && this.redisClient.isOpen) {
        await this.redisClient.flushAll();
      } else {
        this.memoryCache.flushAll();
      }
      return true;
    } catch (error) {
      console.error('Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Determine appropriate TTL based on data type
   * @param {string} dataType - Type of data (MARKET_DATA, STOCK_DATA, etc.)
   * @returns {number} - TTL in seconds
   */
  static getTTL(dataType: keyof typeof DEFAULT_TTL): number {
    return DEFAULT_TTL[dataType] || DEFAULT_TTL.MARKET_DATA;
  }
}

// Singleton instance
export const cacheService = new CacheService(); 