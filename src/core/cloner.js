/**
 * cloner.js — Fully Self-Contained & Fixed Direct Server Cloner
 * Location: src/core/cloner.js
 */

import { logger } from '../ui/logger.js';
import { ChannelType } from 'discord.js';

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

export async function startDirectClone(client, sourceGuildId, targetGuildId, options = {}) {
  const startTime = Date.now();
  const stats = { 
    rolesCreated: 0, 
    categoriesCreated: 0, 
    channelsCreated: 0, 
    emojisCreated: 0, 
    failed: 0, 
    elapsedTime: '0s' 
  };

  // FIXED: cache ki jagah fetch use kiya gaya hai taaki Render par empty na mile
  let sourceGuild = await client.guilds.fetch(sourceGuildId).catch(() => client.guilds.cache.get(sourceGuildId));
  let targetGuild = await client.guilds.fetch(targetGuildId).catch(() => client.guilds.cache.get(targetGuildId));

  if (!sourceGuild) throw new Error(`Source guild ${sourceGuildId} nahi mila - Bot us server me hai?`);
  if (!targetGuild) throw new Error(`Target guild ${targetGuildId} nahi mila - Bot us server me hai?`);

  logger.info(`Veriler tazeleniyor...`);
  try {
    await Promise.all([
      sourceGuild.roles.fetch(),
      sourceGuild.channels.fetch(),
      sourceGuild.emojis.fetch().catch(() => {}),
      targetGuild.roles.fetch(),
      targetGuild.channels.fetch(),
    ]);
  } catch (e) { 
    logger.warn(`Fetch warn: ${e.message}`); 
  }

  logger.info(`Kaynak: "${sourceGuild.name}" [${sourceGuild.roles.cache.size} Rol, ${sourceGuild.channels.cache.size} Kanal, ${sourceGuild.emojis.cache.size} Emoji]`);
  logger.info(`Hedef: "${targetGuild.name}" [${targetGuild.roles.cache.size} Rol, ${targetGuild.channels.cache.size} Kanal]`);

  // Stage 1: Cleaning - Command wale protected channel ko skip karo
  const protectedId = options.protectedChannelId;
  if (options.clearTarget !== false) {
    const toDelete = targetGuild.channels.cache.filter(c => c.id !== protectedId && c.deletable);
    logger.info(`Cleaning ${toDelete.size} channels... (protected: ${protectedId || 'none'})`);
    for (const [, ch] of toDelete) {
      try { 
        await ch.delete().catch(() => {}); 
        await sleep(600); 
      } catch {}
    }
  }

  // Stage 2: Settings (Name & Icon)
  try {
    if (sourceGuild.iconURL()) {
      await targetGuild.setIcon(sourceGuild.iconURL({ size: 1024 })).catch(() => {});
    }
    if (sourceGuild.name !== targetGuild.name) {
      await targetGuild.setName(sourceGuild.name).catch(() => {});
    }
    logger.info(`Server info cloned: ${sourceGuild.name}`);
  } catch {}

  // Stage 3: Roles
  const roles = sourceGuild.roles.cache
    .filter(r => !r.managed && r.name !== '@everyone')
    .sort((a, b) => b.position - a.position);
    
  logger.info(`Cloning ${roles.size} roles...`);
  const roleMap = new Map();
  for (const role of [...roles.values()].reverse()) {
    try {
      const newRole = await targetGuild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
      });
      roleMap.set(role.id, newRole.id);
      stats.rolesCreated++;
      await sleep(700);
    } catch (e) { 
      logger.warn(`Role fail ${role.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // Stage 4: Categories
  const categories = sourceGuild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
    
  logger.info(`Cloning ${categories.size} categories...`);
  const catMap = new Map();
  for (const [, cat] of categories) {
    try {
      const newCat = await targetGuild.channels.create({ 
        name: cat.name, 
        type: ChannelType.GuildCategory 
      });
      catMap.set(cat.id, newCat.id);
      stats.categoriesCreated++;
      await sleep(700);
    } catch (e) { 
      logger.warn(`Cat fail ${cat.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // Stage 5: Channels
  const channels = sourceGuild.channels.cache
    .filter(c => [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement].includes(c.type))
    .sort((a, b) => a.position - b.position);
    
  logger.info(`Cloning ${channels.size} channels...`);
  for (const [, ch] of channels) {
    try {
      const parent = ch.parentId ? catMap.get(ch.parentId) : null;
      await targetGuild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: parent || undefined,
        topic: ch.topic || undefined,
        nsfw: ch.nsfw || undefined,
      });
      stats.channelsCreated++;
      await sleep(1000);
    } catch (e) { 
      logger.warn(`Channel fail ${ch.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // Stage 6: Emojis
  const emojis = sourceGuild.emojis.cache;
  logger.info(`Cloning ${emojis.size} emojis...`);
  for (const [, emoji] of emojis) {
    if (targetGuild.emojis.cache.size >= 50) break;
    if (targetGuild.emojis.cache.some(e => e.name === emoji.name)) continue;
    try {
      await targetGuild.emojis.create({ 
        attachment: emoji.url, 
        name: emoji.name 
      });
      stats.emojisCreated++;
      await sleep(1200);
    } catch (e) { 
      logger.warn(`Emoji fail ${emoji.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  stats.elapsedTime = `${elapsed}s`;
  
  logger.info(`✅ DONE - Roles: ${stats.rolesCreated}, Cats: ${stats.categoriesCreated}, Channels: ${stats.channelsCreated}, Emojis: ${stats.emojisCreated}, Failed: ${stats.failed}, Time: ${stats.elapsedTime}`);
  
  return stats;
}
