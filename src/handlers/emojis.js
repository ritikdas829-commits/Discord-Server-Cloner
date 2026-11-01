import { logger } from '../ui/logger.js';
import { downloadImageAsBase64 } from './guild.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

export async function cloneEmojis(sourceGuild, targetGuild, stats) {
  const emojis = sourceGuild.emojis.cache;
  const totalEmojis = emojis.size;

  if (totalEmojis === 0) {
    logger.info('Kaynak sunucuda kopyalanacak emoji bulunamadı.');
    return;
  }

  logger.info(`Emojiler taranıyor... Toplam emoji: ${totalEmojis}`);

  const tierEmojiLimits = { NONE: 50, TIER_1: 100, TIER_2: 150, TIER_3: 250 };
  const maxEmojis = tierEmojiLimits[targetGuild.premiumTier] || 50;
  const currentCount = targetGuild.emojis.cache.size;
  const availableSlots = Math.max(0, maxEmojis - currentCount);

  if (availableSlots <= 0) {
    logger.warn('Hedef sunucuda boş emoji slotu kalmadı.');
    return;
  }

  const emojisToClone = Array.from(emojis.values()).slice(0, availableSlots);
  let index = 0;

  for (const emoji of emojisToClone) {
    index++;
    if (targetGuild.emojis.cache.some((e) => e.name === emoji.name)) {
      logger.info(`[${index}/${emojisToClone.length}] Emoji zaten mevcut: :${emoji.name}:`);
      continue;
    }

    try {
      const emojiUrl = emoji.url;
      const emojiData = await downloadImageAsBase64(emojiUrl);

      if (!emojiData) {
        logger.warn(`Emoji indirilemedi: :${emoji.name}:`);
        stats.failed++;
        continue;
      }

      await executeWithRetry(
        async () => {
          // FIXED for v14 - object syntax
          return await targetGuild.emojis.create({
            attachment: emojiData,
            name: emoji.name,
            reason: 'Viqole Cloner Tarafından Oluşturuldu'
          });
        },
        `Emoji: ${emoji.name}`
      );

      stats.emojisCreated++;
      logger.info(`[${index}/${emojisToClone.length}] Oluşturuldu: [Emoji] :${emoji.name}:`);
      await sleep(DELAY_CONFIG.EMOJI_CREATE || 1500);
    } catch (err) {
      logger.error(`Emoji fail (:${emoji.name}:): ${err.message}`);
      stats.failed++;
      await sleep(1000);
    }
  }

  logger.success(`Emoji klonlama tamamlandı. Toplam: ${stats.emojisCreated} emoji.`);
}
