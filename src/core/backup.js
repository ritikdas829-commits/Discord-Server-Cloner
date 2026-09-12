import fs from 'fs/promises';
import path from 'path';
import { logger } from '../ui/logger.js';
import { downloadImageAsBase64 } from '../handlers/guild.js';

/**
 * Creates a complete, portable JSON template backup from a Discord guild.
 * @param {Guild} sourceGuild
 * @param {Object} options
 */
export async function createBackup(sourceGuild, options = {}) {
  logger.info(`"${sourceGuild.name}" sunucusu için JSON şablonu oluşturuluyor...`);

  const backupData = {
    meta: {
      version: '1.0.0',
      creator: 'viqole',
      createdAt: new Date().toISOString(),
      sourceGuildId: sourceGuild.id,
      sourceGuildName: sourceGuild.name
    },
    guild: {
      name: sourceGuild.name,
      verificationLevel: sourceGuild.verificationLevel,
      defaultMessageNotifications: sourceGuild.defaultMessageNotifications,
      explicitContentFilter: sourceGuild.explicitContentFilter,
      icon: null,
      banner: null,
      splash: null
    },
    roles: [],
    categories: [],
    channels: [],
    emojis: []
  };

  // 1. Guild Media
  if (sourceGuild.iconURL()) {
    logger.info('Sunucu ikonu indiriliyor...');
    backupData.guild.icon = await downloadImageAsBase64(
      sourceGuild.iconURL({ format: 'png', dynamic: true, size: 1024 })
    );
  }

  if (sourceGuild.bannerURL()) {
    logger.info('Sunucu afişi indiriliyor...');
    backupData.guild.banner = await downloadImageAsBase64(
      sourceGuild.bannerURL({ format: 'png', size: 1024 })
    );
  }

  if (sourceGuild.splashURL()) {
    backupData.guild.splash = await downloadImageAsBase64(
      sourceGuild.splashURL({ format: 'png', size: 1024 })
    );
  }

  // 2. Roles
  logger.info('Roller yedekleniyor...');
  const roles = sourceGuild.roles.cache.sort((a, b) => a.position - b.position);
  roles.forEach((role) => {
    backupData.roles.push({
      originalId: role.id,
      name: role.name,
      color: role.hexColor,
      permissions: role.permissions.bitfield.toString(),
      hoist: role.hoist,
      mentionable: role.mentionable,
      position: role.position,
      isEveryone: role.id === sourceGuild.id,
      managed: role.managed
    });
  });

  // Helper for overwrites
  const formatOverwrites = (channel) => {
    const list = [];
    if (!channel.permissionOverwrites) return list;
    channel.permissionOverwrites.cache.forEach((ow) => {
      const role = ow.type === 'role' ? sourceGuild.roles.cache.get(ow.id) : null;
      list.push({
        type: ow.type,
        id: ow.id,
        roleName: role ? role.name : null,
        allow: ow.allow.bitfield.toString(),
        deny: ow.deny.bitfield.toString()
      });
    });
    return list;
  };

  // 3. Categories
  logger.info('Kategoriler yedekleniyor...');
  const categories = sourceGuild.channels.cache
    .filter((ch) => ch.type === 'GUILD_CATEGORY')
    .sort((a, b) => a.position - b.position);

  categories.forEach((cat) => {
    backupData.categories.push({
      originalId: cat.id,
      name: cat.name,
      position: cat.position,
      permissions: formatOverwrites(cat)
    });
  });

  // 4. Channels
  logger.info('Kanallar yedekleniyor...');
  const channels = sourceGuild.channels.cache
    .filter((ch) => ['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_NEWS'].includes(ch.type))
    .sort((a, b) => a.position - b.position);

  channels.forEach((ch) => {
    backupData.channels.push({
      originalId: ch.id,
      name: ch.name,
      type: ch.type,
      position: ch.position,
      parentCategoryName: ch.parent ? ch.parent.name : null,
      parentCategoryOriginalId: ch.parent ? ch.parent.id : null,
      topic: ch.topic || null,
      nsfw: ch.nsfw || false,
      rateLimitPerUser: ch.rateLimitPerUser || 0,
      bitrate: ch.bitrate || 64000,
      userLimit: ch.userLimit || 0,
      permissions: formatOverwrites(ch)
    });
  });

  // 5. Emojis
  if (options.backupEmojis !== false && sourceGuild.emojis.cache.size > 0) {
    logger.info(`Emojiler yedekleniyor (${sourceGuild.emojis.cache.size} adet)...`);
    for (const [, emoji] of sourceGuild.emojis.cache) {
      const imgData = await downloadImageAsBase64(emoji.url);
      if (imgData) {
        backupData.emojis.push({
          name: emoji.name,
          data: imgData
        });
      }
    }
  }

  // 6. Save to file
  const backupsDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupsDir, { recursive: true });

  const safeName = sourceGuild.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  const filename = `${safeName}-${Date.now()}.json`;
  const filePath = path.join(backupsDir, filename);

  await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
  logger.success(`Yedek şablon başarıyla oluşturuldu: backups/${filename}`);

  return { filePath, filename, backupData };
}
