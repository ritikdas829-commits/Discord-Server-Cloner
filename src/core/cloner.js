/**
 * cloner.js — Premium UI + Live Progress + Order Fix + Self-Contained
 * Location: src/core/cloner.js
 * Fixed: Reverse order (1,2,3,4,5), Rank fix, Live Status, Deletion Stats
 */

import { logger } from '../ui/logger.js';
import { ChannelType } from 'discord.js';

function sleep(ms) { 
  return new Promise(r => setTimeout(r, ms)); 
}

export async function startDirectClone(client, sourceGuildId, targetGuildId, options = {}, onProgress = null) {
  const startTime = Date.now();
  const stats = { 
    rolesCreated: 0, 
    categoriesCreated: 0, 
    channelsCreated: 0, 
    textCreated: 0,
    voiceCreated: 0,
    emojisCreated: 0, 
    failed: 0, 
    elapsedTime: '0s',
    deleted: { channels: 0, roles: 0, emojis: 0 }
  };

  const report = (stage, data) => {
    if (onProgress) onProgress({ stage, ...data, delStats: stats.deleted, stats });
  };

  // FIXED: fetch use karo taaki Render par empty na mile
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

  // Stage 1: Cleaning + Deletion Stats
  const protectedId = options.protectedChannelId;
  const delStats = { channels: { done: 0, total: 0 }, roles: { done: 0, total: 0 }, emojis: { done: 0, total: 0 } };

  if (options.clearTarget !== false) {
    const toDeleteChannels = targetGuild.channels.cache.filter(c => c.id !== protectedId && c.deletable);
    const toDeleteRoles = targetGuild.roles.cache.filter(r => !r.managed && r.name !== '@everyone' && r.editable);
    const toDeleteEmojis = targetGuild.emojis.cache.filter(e => e.deletable);

    delStats.channels.total = toDeleteChannels.size;
    delStats.roles.total = toDeleteRoles.size;
    delStats.emojis.total = toDeleteEmojis.size;

    logger.info(`Cleaning ${toDeleteChannels.size} channels, ${toDeleteRoles.size} roles, ${toDeleteEmojis.size} emojis... (protected: ${protectedId || 'none'})`);

    for (const [, ch] of toDeleteChannels) {
      try { 
        await ch.delete().catch(() => {}); 
        delStats.channels.done++;
        stats.deleted.channels++;
        report('DELETE', { delStats });
        await sleep(300); 
      } catch {}
    }
    for (const [, role] of toDeleteRoles) {
      try { 
        await role.delete().catch(() => {}); 
        delStats.roles.done++;
        stats.deleted.roles++;
        report('DELETE', { delStats });
        await sleep(300); 
      } catch {}
    }
    for (const [, emoji] of toDeleteEmojis) {
      try { 
        await emoji.delete().catch(() => {}); 
        delStats.emojis.done++;
        stats.deleted.emojis++;
        report('DELETE', { delStats });
        await sleep(300); 
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

  // Stage 3: Roles - ORDER FIX: ASCENDING (1,2,3,4,5)
  const roles = sourceGuild.roles.cache
    .filter(r => !r.managed && r.name !== '@everyone')
    .sort((a, b) => a.position - b.position); // FIXED: ASCENDING
    
  logger.info(`Cloning ${roles.size} roles in correct order...`);
  const roleMap = new Map();
  const createdRolesList = [];
  
  for (const role of [...roles.values()]) {
    try {
      const exists = targetGuild.roles.cache.find(r => r.name === role.name);
      let newRole = exists;
      if (!exists) {
        newRole = await targetGuild.roles.create({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          permissions: role.permissions,
          mentionable: role.mentionable,
        });
      }
      roleMap.set(role.id, newRole.id);
      createdRolesList.push({ newRole, sourcePos: role.position });
      stats.rolesCreated++;
      report('ROLES', { done: stats.rolesCreated, total: roles.size });
      await sleep(600);
    } catch (e) { 
      logger.warn(`Role fail ${role.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // FIX RANK: Set role positions after all created
  try {
    createdRolesList.sort((a, b) => a.sourcePos - b.sourcePos);
    for (const item of createdRolesList) {
      try { await item.newRole.setPosition(item.sourcePos).catch(()=>{}); await sleep(200); } catch {}
    }
  } catch {}

  // Stage 4: Categories - ORDER FIX
  const categories = sourceGuild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position); // FIXED ASC
    
  logger.info(`Cloning ${categories.size} categories...`);
  const catMap = new Map();
  const catCreatedList = [];

  for (const [, cat] of categories) {
    try {
      const newCat = await targetGuild.channels.create({ 
        name: cat.name, 
        type: ChannelType.GuildCategory 
      });
      catMap.set(cat.id, newCat.id);
      catCreatedList.push({ newId: newCat.id, sourcePos: cat.position });
      stats.categoriesCreated++;
      report('CATEGORIES', { done: stats.categoriesCreated, total: categories.size });
      await sleep(500);
    } catch (e) { 
      logger.warn(`Cat fail ${cat.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // Fix category positions
  try {
    catCreatedList.sort((a,b) => a.sourcePos - b.sourcePos);
    for (const item of catCreatedList) {
      try { const ch = await targetGuild.channels.fetch(item.newId).catch(()=>null); if (ch) await ch.setPosition(item.sourcePos).catch(()=>{}); await sleep(200); } catch {}
    }
  } catch {}

  // Stage 5: Text Channels - ORDER FIX
  const textChannels = sourceGuild.channels.cache
    .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
    .sort((a, b) => a.position - b.position);
    
  logger.info(`Cloning ${textChannels.size} text channels...`);
  const textCreatedList = [];

  for (const [, ch] of textChannels) {
    try {
      const parent = ch.parentId ? catMap.get(ch.parentId) : null;
      const newCh = await targetGuild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: parent || undefined,
        topic: ch.topic || undefined,
        nsfw: ch.nsfw || undefined,
        rateLimitPerUser: ch.rateLimitPerUser || undefined,
      });
      textCreatedList.push({ newId: newCh.id, sourcePos: ch.position });
      stats.channelsCreated++;
      stats.textCreated++;
      report('TEXT', { done: stats.textCreated, total: textChannels.size });
      await sleep(700);
    } catch (e) { 
      logger.warn(`Channel fail ${ch.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // Stage 6: Voice Channels - ORDER FIX
  const voiceChannels = sourceGuild.channels.cache
    .filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
    .sort((a, b) => a.position - b.position);
    
  logger.info(`Cloning ${voiceChannels.size} voice channels...`);
  const voiceCreatedList = [];

  for (const [, ch] of voiceChannels) {
    try {
      const parent = ch.parentId ? catMap.get(ch.parentId) : null;
      const newCh = await targetGuild.channels.create({
        name: ch.name,
        type: ch.type,
        parent: parent || undefined,
        bitrate: ch.bitrate || undefined,
        userLimit: ch.userLimit || undefined,
      });
      voiceCreatedList.push({ newId: newCh.id, sourcePos: ch.position });
      stats.channelsCreated++;
      stats.voiceCreated++;
      report('VOICE', { done: stats.voiceCreated, total: voiceChannels.size });
      await sleep(700);
    } catch (e) { 
      logger.warn(`Channel fail ${ch.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  // FIX ALL CHANNEL POSITIONS AT END - Correct order 1,2,3,4,5
  try {
    const allToFix = [...catCreatedList, ...textCreatedList, ...voiceCreatedList].sort((a,b) => a.sourcePos - b.sourcePos);
    for (const item of allToFix) {
      try { const ch = await targetGuild.channels.fetch(item.newId).catch(()=>null); if (ch) await ch.setPosition(item.sourcePos).catch(()=>{}); await sleep(200); } catch {}
    }
    logger.info(`Fixed ${allToFix.length} channel positions - order correct now!`);
  } catch {}

  // Stage 7: Emojis
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
      report('EMOJIS', { done: stats.emojisCreated, total: emojis.size });
      await sleep(800);
    } catch (e) { 
      logger.warn(`Emoji fail ${emoji.name}: ${e.message}`); 
      stats.failed++; 
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  stats.elapsedTime = `${elapsed}s`;
  
  logger.info(`DONE - Roles: ${stats.rolesCreated}, Cats: ${stats.categoriesCreated}, Channels: ${stats.channelsCreated} (Text:${stats.textCreated} Voice:${stats.voiceCreated}), Emojis: ${stats.emojisCreated}, Failed: ${stats.failed}, Time: ${stats.elapsedTime}`);
  
  // Return structure for Premium UI
  return {
    rolesCreated: stats.rolesCreated,
    categoriesCreated: stats.categoriesCreated,
    channelsCreated: stats.channelsCreated,
    textCreated: stats.textCreated,
    voiceCreated: stats.voiceCreated,
    emojisCreated: stats.emojisCreated,
    failed: stats.failed,
    elapsedTime: stats.elapsedTime,
    deleted: stats.deleted,
    // For compatibility with new premium index.js
    deletedChannels: stats.deleted.channels,
    deletedRoles: stats.deleted.roles,
    deletedEmojis: stats.deleted.emojis,
    roles: { cloned: stats.rolesCreated },
    categories: { cloned: stats.categoriesCreated },
    text: { cloned: stats.textCreated },
    voice: { cloned: stats.voiceCreated },
    emojis: { cloned: stats.emojisCreated }
  };
}
