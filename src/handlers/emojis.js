/**
 * emojis.js — Premium UI + Live Progress + Direct URL Fix
 * Location: src/handlers/emojis.js
 * Fixed: Base64 error, now uses direct URL, faster cloning
 */

import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

export async function cloneEmojis(sourceGuild, targetGuild, stats, onProgress = null) {
  stats = stats || { emojisCreated: 0, failed: 0 };
  const emojis = sourceGuild.emojis.cache;
  const totalEmojis = emojis.size;

  if (totalEmojis === 0) {
    logger.info('Kaynak sunucuda kopyalanacak emoji bulunamadı.');
    return 0;
  }

  logger.info(`Emojiler taranıyor... Toplam emoji: ${totalEmojis}`);

  const tierEmojiLimits = { NONE: 50, TIER_1: 100, TIER_2: 150, TIER_3: 250 };
  const maxEmojis = tierEmojiLimits[targetGuild.premiumTier] || 50;
  const currentCount = targetGuild.emojis.cache.size;
  const availableSlots = Math.max(0, maxEmojis - currentCount);

  if (availableSlots <= 0) {
    logger.warn('Hedef sunucuda boş emoji slotu kalmadı.');
    return 0;
  }

  const emojisToClone = Array.from(emojis.values()).slice(0, availableSlots);
  let cloned = 0;
  let index = 0;

  for (const emoji of emojisToClone) {
    index++;
    
    // Skip if already exists
    if (targetGuild.emojis.cache.some((e) => e.name === emoji.name)) {
      logger.info(`[${index}/${emojisToClone.length}] Emoji zaten mevcut: :${emoji.name}:`);
      cloned++;
      if (onProgress) onProgress(cloned, emojisToClone.length, emoji.name);
      continue;
    }

    try {
      // FIXED: Use direct URL instead of base64 - faster and no buffer error
      await executeWithRetry(
        async () => {
          return await targetGuild.emojis.create({
            attachment: emoji.url, // Direct URL - FIXED
            name: emoji.name,
            reason: 'Cloner - Premium UI'
          });
        },
        `Emoji: ${emoji.name}`
      );

      stats.emojisCreated++;
      cloned++;
      
      // Live progress for premium UI
      if (onProgress) onProgress(cloned, emojisToClone.length, emoji.name);

      logger.info(`[${index}/${emojisToClone.length}] Oluşturuldu: [Emoji] :${emoji.name}:`);
      await sleep(DELAY_CONFIG.EMOJI_CREATE || 1000);
      
    } catch (err) {
      logger.error(`Emoji fail (:${emoji.name}:): ${err.message}`);
      stats.failed++;
      await sleep(1000);
    }
  }

  logger.success(`Emoji klonlama tamamlandı. Toplam: ${stats.emojisCreated} emoji.`);
  return cloned;
}
