import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';
import { ChannelType, OverwriteType } from 'discord.js';

const MAX_BITRATE_TIER = {
  NONE: 64000,
  TIER_1: 128000,
  TIER_2: 256000,
  TIER_3: 384000
};

export function mapOverwrites(permissionOverwrites, roleMap, targetGuild) {
  const mapped = [];
  if (!permissionOverwrites || !permissionOverwrites.cache) return mapped;

  permissionOverwrites.cache.forEach((overwrite) => {
    let targetId = null;
    if (overwrite.type === OverwriteType.Role || overwrite.type === 0) {
      targetId = roleMap.get(overwrite.id);
      if (!targetId) {
        const sourceRole = overwrite.channel?.guild?.roles?.cache?.get(overwrite.id);
        if (sourceRole) {
          const fallbackRole = targetGuild.roles.cache.find((r) => r.name === sourceRole.name);
          if (fallbackRole) targetId = fallbackRole.id;
        }
      }
    } else if (overwrite.type === OverwriteType.Member || overwrite.type === 1) {
      if (targetGuild.members.cache.has(overwrite.id)) {
        targetId = overwrite.id;
      }
    }
    if (targetId) {
      mapped.push({
        id: targetId,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield
      });
    }
  });
  return mapped;
}

export async function cloneChannels(sourceGuild, targetGuild, roleMap, stats) {
  logger.info('Kategoriler ve kanallar taranıyor...');

  const categoryMap = new Map();
  const channelMap = new Map();

  // 1. Clone Categories - FIXED for v14
  const categories = sourceGuild.channels.cache
    .filter((ch) => ch.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);

  logger.info(`Klonlanacak kategori sayısı: ${categories.size}`);
  let catIndex = 0;
  for (const [, category] of categories) {
    catIndex++;
    try {
      const overwrites = mapOverwrites(category.permissionOverwrites, roleMap, targetGuild);
      const newCategory = await executeWithRetry(
        async () => {
          return await targetGuild.channels.create({
            name: category.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: overwrites,
          });
        },
        `Kategori: ${category.name}`
      );
      categoryMap.set(category.id, newCategory.id);
      stats.categoriesCreated++;
      logger.info(`[${catIndex}/${categories.size}] Oluşturuldu: [Kategori] 📁 ${category.name}`);
      await sleep(DELAY_CONFIG.CATEGORY_CREATE || 1000);
    } catch (err) {
      logger.error(`Kategori fail (${category.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // 2. Clone Text & Voice
  const channels = sourceGuild.channels.cache
    .filter((ch) => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement].includes(ch.type))
    .sort((a, b) => a.position - b.position);

  logger.info(`Klonlanacak kanal sayısı: ${channels.size}`);
  let chIndex = 0;
  for (const [, channel] of channels) {
    chIndex++;
    try {
      const overwrites = mapOverwrites(channel.permissionOverwrites, roleMap, targetGuild);
      const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;

      const channelOptions = {
        name: channel.name,
        type: channel.type,
        parent: parentId || undefined,
        permissionOverwrites: overwrites,
      };

      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
        channelOptions.topic = channel.topic || undefined;
        channelOptions.nsfw = channel.nsfw;
        channelOptions.rateLimitPerUser = channel.rateLimitPerUser || 0;
      } else if (channel.type === ChannelType.GuildVoice) {
        let maxBitrate = MAX_BITRATE_TIER[targetGuild.premiumTier] || 64000;
        channelOptions.bitrate = Math.min(channel.bitrate || 64000, maxBitrate);
        channelOptions.userLimit = channel.userLimit || 0;
      }

      const newChannel = await executeWithRetry(
        async () => { return await targetGuild.channels.create(channelOptions); },
        `Kanal: ${channel.name}`
      );

      channelMap.set(channel.id, newChannel);
      stats.channelsCreated++;
      const icon = channel.type === ChannelType.GuildVoice ? '🔊' : channel.type === ChannelType.GuildAnnouncement ? '📢' : '💬';
      logger.info(`[${chIndex}/${channels.size}] Oluşturuldu: [Kanal] ${icon} ${channel.name}`);
      await sleep(DELAY_CONFIG.CHANNEL_CREATE || 1200);
    } catch (err) {
      logger.error(`Kanal fail (${channel.name}): ${err.message}`);
      stats.failed++;
    }
  }

  logger.success(`Kanal ve kategori klonlama tamamlandı. Toplam: ${stats.categoriesCreated} kategori, ${stats.channelsCreated} kanal.`);
  return channelMap;
}
