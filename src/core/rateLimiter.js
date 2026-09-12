import { logger } from '../ui/logger.js';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const DELAY_CONFIG = {
  ROLE_CREATE: 180,
  ROLE_DELETE: 100,
  ROLE_POSITION: 150,
  CATEGORY_CREATE: 200,
  CHANNEL_CREATE: 200,
  CHANNEL_DELETE: 100,
  EMOJI_CREATE: 1000,
  GUILD_EDIT: 400,
  MESSAGE_SEND: 350
};

/**
 * Executes an async Discord action with automatic 429 rate-limit backoff and retries.
 * @param {Function} operation - Async function returning a promise
 * @param {string} actionName - Descriptive name for logging
 * @param {number} maxRetries - Maximum retry count (default 5)
 */
export async function executeWithRetry(operation, actionName = 'İşlem', maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      const isRateLimit = error.status === 429 || error.httpStatus === 429 || error.code === 429 || (error.message && error.message.toLowerCase().includes('rate limit'));
      
      if (isRateLimit) {
        let waitTime = 5000;
        if (error.retryAfter) {
          waitTime = typeof error.retryAfter === 'number' ? error.retryAfter : parseFloat(error.retryAfter) * 1000;
        } else if (error.timeout) {
          waitTime = error.timeout;
        } else {
          waitTime = attempt * 7000;
        }
        
        logger.warn(`Hız Sınırı (429 Rate Limit) yakalandı [${actionName}]. ${Math.ceil(waitTime / 1000)} saniye bekleniyor... (Deneme ${attempt}/${maxRetries})`);
        await sleep(waitTime + 500);
      } else if (error.code === 50035 || error.code === 50013) {
        // Missing Permissions or Invalid Form Body - retrying won't help
        throw error;
      } else {
        if (attempt >= maxRetries) {
          throw error;
        }
        logger.warn(`Beklenmeyen hata [${actionName}]: ${error.message}. 3 sn sonra tekrar deneniyor...`);
        await sleep(3000);
      }
    }
  }
}
