import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

const MAX_BITRATE_TIER = {
  NONE: 64000,
  TIER_1: 128000,
  TIER_2: 256000,
  TIER_3: 384000
};

/**
 * Maps permission overwrites from source guild to target guild using roleMap.
 */
export function mapOverwrites(permissionOverwrites, roleMap, targetGuild) {
  const mapped = [];

  if (!permissionOverwrites || !permissionOverwrites.cache) {
    return mapped;
  }

  permissionOverwrites.cache.forEach((overwrite) => {
    let targetId = null;

    if (overwrite.type === 'role') {
      targetId = roleMap.get(overwrite.id);
      if (!targetId) {
        // Fallback: match by role name if ID wasn't directly found
        const sourceRole = overwrite.channel?.guild?.roles?.cache?.get(overwrite.id);
        if (sourceRole) {
          const fallbackRole = targetGuild.roles.cache.find((r) => r.name === sourceRole.name);
          if (fallbackRole) targetId = fallbackRole.id;
        }
      }
    } else if (overwrite.type === 'member') {
      // If the overwrite is for a specific user, only apply if user is in target guild
      if (targetGuild.members.cache.has(overwrite.id)) {
        targetId = overwrite.id;
      }
    }

    if (targetId) {
      mapped.push({
        id: targetId,
        type: overwrite.type,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield
      });
    }
  });

  return mapped;
}

/**
 * Clones categories and channels with exact parent-child relations and permission overwrites.
 */
export async function cloneChannels(sourceGuild, targetGuild, roleMap, stats) {
  logger.info('Kategoriler ve kanallar taranıyor...');

  const categoryMap = new Map();
  const channelMap = new Map(); // sourceChannelId -> targetChannel

  // 1. Clone Categories
  const categories = sourceGuild.channels.cache
    .filter((ch) => ch.type === 'GUILD_CATEGORY')
    .sort((a, b) => a.position - b.position);

  const totalCategories = categories.size;
  logger.info(`Klonlanacak kategori sayısı: ${totalCategories}`);

  let catIndex = 0;
  for (const [, category] of categories) {
    catIndex++;
    try {
      const overwrites = mapOverwrites(category.permissionOverwrites, roleMap, targetGuild);

      const newCategory = await executeWithRetry(
        async () => {
          return await targetGuild.channels.create(category.name, {
            type: 'GUILD_CATEGORY',
            permissionOverwrites: overwrites,
            position: category.position,
            reason: 'Viqole Cloner Tarafından Oluşturuldu'
          });
        },
        `Kategori Oluşturma: ${category.name}`
      );

      categoryMap.set(category.id, newCategory.id);
      stats.categoriesCreated++;
      logger.info(`[${catIndex}/${totalCategories}] Oluşturuldu: [Kategori] 📁 ${category.name}`);

      await sleep(DELAY_CONFIG.CATEGORY_CREATE);
    } catch (err) {
      logger.error(`Kategori oluşturulamadı (${category.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // 2. Clone Text & Voice & Announcement channels
  const channels = sourceGuild.channels.cache
    .filter((ch) => ['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_NEWS'].includes(ch.type))
    .sort((a, b) => a.position - b.position);

  const totalChannels = channels.size;
  logger.info(`Klonlanacak kanal sayısı: ${totalChannels}`);

  let chIndex = 0;
  for (const [, channel] of channels) {
    chIndex++;
    try {
      const overwrites = mapOverwrites(channel.permissionOverwrites, roleMap, targetGuild);
      const parentId = channel.parent ? categoryMap.get(channel.parent.id) : null;

      const channelOptions = {
        type: channel.type,
        parent: parentId || undefined,
        permissionOverwrites: overwrites,
        position: channel.position,
        reason: 'Viqole Cloner Tarafından Oluşturuldu'
      };

      if (channel.type === 'GUILD_TEXT' || channel.type === 'GUILD_NEWS') {
        channelOptions.topic = channel.topic || undefined;
        channelOptions.nsfw = channel.nsfw;
        channelOptions.rateLimitPerUser = channel.rateLimitPerUser || 0;
      } else if (channel.type === 'GUILD_VOICE') {
        let maxBitrate = MAX_BITRATE_TIER[targetGuild.premiumTier] || 64000;
        channelOptions.bitrate = Math.min(channel.bitrate || 64000, maxBitrate);
        channelOptions.userLimit = channel.userLimit || 0;
      }

      const newChannel = await executeWithRetry(
        async () => {
          return await targetGuild.channels.create(channel.name, channelOptions);
        },
        `Kanal Oluşturma: ${channel.name}`
      );

      channelMap.set(channel.id, newChannel);
      stats.channelsCreated++;
      const icon = channel.type === 'GUILD_VOICE' ? '🔊' : channel.type === 'GUILD_NEWS' ? '📢' : '💬';
      logger.info(`[${chIndex}/${totalChannels}] Oluşturuldu: [Kanal] ${icon} ${channel.name}`);

      await sleep(DELAY_CONFIG.CHANNEL_CREATE);
    } catch (err) {
      logger.error(`Kanal oluşturulamadı (${channel.name}): ${err.message}`);
      stats.failed++;
    }
  }

  logger.success(`Kanal ve kategori klonlama tamamlandı. Toplam: ${stats.categoriesCreated} kategori, ${stats.channelsCreated} kanal.`);
  return channelMap;
}
