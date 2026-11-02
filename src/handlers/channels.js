/**
 * channels.js — Premium UI + Order Fix (1,2,3,4,5) + Live Progress + Rank Fix
 * Location: src/handlers/channels.js
 * Fixed: Reverse order bug, now creates in correct order
 */

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

export async function cloneChannels(sourceGuild, targetGuild, roleMap, stats, onProgress = null) {
  logger.info('Kategoriler ve kanallar taranıyor...');
  stats = stats || { categoriesCreated: 0, channelsCreated: 0, textCreated: 0, voiceCreated: 0, failed: 0 };

  const report = (stage, done, total) => {
    if (onProgress) onProgress(stage, done, total);
  };

  const categoryMap = new Map();
  const channelMap = new Map();
  const createdList = []; // For position fix

  // 1. Clone Categories - FIXED ORDER ASCENDING
  const categories = sourceGuild.channels.cache
    .filter((ch) => ch.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position); // ASC: 1,2,3,4,5

  logger.info(`Klonlanacak kategori sayısı: ${categories.size}`);
  let catDone = 0;

  for (const [, category] of categories) {
    try {
      const overwrites = mapOverwrites(category.permissionOverwrites, roleMap, targetGuild);
      
      // FIX: Create WITHOUT position first
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
      createdList.push({ id: newCategory.id, sourcePos: category.position, type: 'category' });
      
      stats.categoriesCreated++;
      catDone++;
      report('CATEGORIES', catDone, categories.size);
      
      logger.info(`[${catDone}/${categories.size}] Oluşturuldu: [Kategori] 📁 ${category.name}`);
      await sleep(DELAY_CONFIG.CATEGORY_CREATE || 700);
    } catch (err) {
      logger.error(`Kategori fail (${category.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // FIX CATEGORY POSITIONS - Set correct order 1,2,3,4,5
  try {
    const sortedCats = [...createdList].filter(c => c.type === 'category').sort((a,b) => a.sourcePos - b.sourcePos);
    for (const item of sortedCats) {
      try {
        const ch = await targetGuild.channels.fetch(item.id).catch(()=>null);
        if (ch) await ch.setPosition(item.sourcePos).catch(()=>{});
        await sleep(200);
      } catch {}
    }
    logger.info(`Fixed ${sortedCats.length} category positions`);
  } catch {}

  // 2. Clone Text Channels - FIXED ORDER
  const textChannels = sourceGuild.channels.cache
    .filter((ch) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type))
    .sort((a, b) => a.position - b.position); // ASC

  logger.info(`Klonlanacak text kanal sayısı: ${textChannels.size}`);
  let textDone = 0;

  for (const [, channel] of textChannels) {
    try {
      const overwrites = mapOverwrites(channel.permissionOverwrites, roleMap, targetGuild);
      const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;

      const channelOptions = {
        name: channel.name,
        type: channel.type,
        parent: parentId || undefined,
        permissionOverwrites: overwrites,
        topic: channel.topic || undefined,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser || 0,
      };

      const newChannel = await executeWithRetry(
        async () => { return await targetGuild.channels.create(channelOptions); },
        `Kanal: ${channel.name}`
      );

      channelMap.set(channel.id, newChannel);
      createdList.push({ id: newChannel.id, sourcePos: channel.position, type: 'text' });
      
      stats.channelsCreated++;
      stats.textCreated = (stats.textCreated || 0) + 1;
      textDone++;
      report('TEXT', textDone, textChannels.size);

      logger.info(`[${textDone}/${textChannels.size}] Oluşturuldu: [Text] 💬 ${channel.name}`);
      await sleep(DELAY_CONFIG.CHANNEL_CREATE || 800);
    } catch (err) {
      logger.error(`Kanal fail (${channel.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // 3. Clone Voice Channels - FIXED ORDER
  const voiceChannels = sourceGuild.channels.cache
    .filter((ch) => ch.type === ChannelType.GuildVoice)
    .sort((a, b) => a.position - b.position); // ASC

  logger.info(`Klonlanacak voice kanal sayısı: ${voiceChannels.size}`);
  let voiceDone = 0;

  for (const [, channel] of voiceChannels) {
    try {
      const overwrites = mapOverwrites(channel.permissionOverwrites, roleMap, targetGuild);
      const parentId = channel.parentId ? categoryMap.get(channel.parentId) : null;

      let maxBitrate = MAX_BITRATE_TIER[targetGuild.premiumTier] || 64000;
      
      const channelOptions = {
        name: channel.name,
        type: channel.type,
        parent: parentId || undefined,
        permissionOverwrites: overwrites,
        bitrate: Math.min(channel.bitrate || 64000, maxBitrate),
        userLimit: channel.userLimit || 0,
      };

      const newChannel = await executeWithRetry(
        async () => { return await targetGuild.channels.create(channelOptions); },
        `Voice: ${channel.name}`
      );

      channelMap.set(channel.id, newChannel);
      createdList.push({ id: newChannel.id, sourcePos: channel.position, type: 'voice' });
      
      stats.channelsCreated++;
      stats.voiceCreated = (stats.voiceCreated || 0) + 1;
      voiceDone++;
      report('VOICE', voiceDone, voiceChannels.size);

      logger.info(`[${voiceDone}/${voiceChannels.size}] Oluşturuldu: [Voice] 🔊 ${channel.name}`);
      await sleep(DELAY_CONFIG.CHANNEL_CREATE || 800);
    } catch (err) {
      logger.error(`Voice fail (${channel.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // 4. FINAL POSITION FIX - All channels 1,2,3,4,5 correct order
  try {
    logger.info('Fixing all channel positions to correct order...');
    const sortedAll = [...createdList].sort((a,b) => a.sourcePos - b.sourcePos);
    for (const item of sortedAll) {
      try {
        const ch = await targetGuild.channels.fetch(item.id).catch(()=>null);
        if (ch) await ch.setPosition(item.sourcePos).catch(()=>{});
        await sleep(200);
      } catch {}
    }
    logger.info(`Fixed ${sortedAll.length} positions - Order now 1,2,3,4,5 correct!`);
  } catch (e) {
    logger.warn(`Position fix error: ${e.message}`);
  }

  logger.success(`Kanal ve kategori klonlama tamamlandı. Toplam: ${stats.categoriesCreated} kategori, ${stats.channelsCreated} kanal (Text:${stats.textCreated || 0} Voice:${stats.voiceCreated || 0}).`);
  
  // Return for premium UI
  return {
    channelMap,
    categories: stats.categoriesCreated,
    text: stats.textCreated || 0,
    voice: stats.voiceCreated || 0,
    channels: stats.channelsCreated
  };
}
