import fs from 'fs/promises';
import { logger } from '../ui/logger.js';
import { clearTargetGuild } from '../handlers/guild.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from './rateLimiter.js';

/**
 * Restores a guild from a JSON backup template file.
 * @param {string} backupFilePath - Path to the JSON backup file
 * @param {Guild} targetGuild - Target Discord guild object
 * @param {Object} options - Restore options
 */
export async function restoreBackup(backupFilePath, targetGuild, options = {}) {
  const startTime = Date.now();
  const stats = {
    rolesCreated: 0,
    categoriesCreated: 0,
    channelsCreated: 0,
    emojisCreated: 0,
    messagesCloned: 0,
    failed: 0,
    elapsedTime: '0s'
  };

  logger.info(`Şablon dosyası okunuyor: ${backupFilePath}`);
  const rawData = await fs.readFile(backupFilePath, 'utf-8');
  const backup = JSON.parse(rawData);

  logger.info(`Şablon Bilgisi: "${backup.guild?.name || 'Bilinmeyen'}" (Hazırlayan: ${backup.meta?.creator || 'viqole'})`);

  // Aşama 1: Temizlik
  if (options.clearBeforeRestore !== false) {
    logger.step(1, 5, 'Hedef Sunucu Temizliği');
    await clearTargetGuild(targetGuild, stats);
  }

  // Aşama 2: Sunucu Genel Ayarları ve Görselleri
  logger.step(2, 5, 'Sunucu Temel Ayarları & Görseller');
  try {
    if (backup.guild?.name) {
      await targetGuild.setName(backup.guild.name);
      logger.success(`Sunucu ismi güncellendi: ${backup.guild.name}`);
    }
    if (backup.guild?.icon) {
      try {
        await targetGuild.setIcon(backup.guild.icon);
        logger.success('Sunucu ikonu geri yüklendi.');
      } catch (err) {
        logger.warn(`İkon yüklenemedi: ${err.message}`);
      }
    }
    if (backup.guild?.banner) {
      try {
        await targetGuild.setBanner(backup.guild.banner);
        logger.success('Sunucu bannerı geri yüklendi.');
      } catch {
        logger.warn('Sunucu bannerı ayarlanamadı (Boost seviyesi yetersiz olabilir).');
      }
    }
  } catch (err) {
    logger.warn(`Sunucu ayarları uygulanırken hata: ${err.message}`);
  }

  // Aşama 3: Rolleri Geri Yükleme ve İzin Eşleme
  logger.step(3, 5, 'Roller ve İzin Hiyerarşisi');
  const roleMap = new Map(); // originalId -> newRoleId

  // Everyone role
  const targetEveryone = targetGuild.roles.everyone;
  const everyoneData = backup.roles.find((r) => r.isEveryone);
  if (everyoneData) {
    roleMap.set(everyoneData.originalId, targetEveryone.id);
    try {
      await targetEveryone.setPermissions(BigInt(everyoneData.permissions));
      logger.success('@everyone rol izinleri güncellendi.');
    } catch (err) {
      logger.warn(`@everyone izinleri uygulanamadı: ${err.message}`);
    }
  }

  // Other roles sorted by position DESCENDING (highest to lowest)
  const nonEveryoneRoles = backup.roles
    .filter((r) => !r.isEveryone && !r.managed)
    .sort((a, b) => b.position - a.position);

  for (const roleData of nonEveryoneRoles) {
    try {
      const newRole = await executeWithRetry(
        async () => {
          return await targetGuild.roles.create({
            name: roleData.name,
            color: roleData.color,
            permissions: BigInt(roleData.permissions),
            hoist: roleData.hoist,
            mentionable: roleData.mentionable,
            reason: 'Viqole Cloner Şablon Geri Yükleme'
          });
        },
        `Rol Yükleme: ${roleData.name}`
      );

      roleMap.set(roleData.originalId, newRole.id);
      stats.rolesCreated++;
      logger.info(`[${stats.rolesCreated}/${nonEveryoneRoles.length}] Oluşturuldu: [Rol] ${roleData.name}`);
      await sleep(DELAY_CONFIG.ROLE_CREATE);
    } catch (err) {
      logger.error(`Rol oluşturulamadı (${roleData.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // Aşama 4: Kategoriler ve Kanallar
  logger.step(4, 5, 'Kategoriler ve Kanallar');
  const categoryMap = new Map(); // originalId -> newCategoryId

  // Categories
  for (const catData of backup.categories || []) {
    try {
      const overwrites = (catData.permissions || []).map((p) => {
        const targetRoleId = roleMap.get(p.id) || (p.roleName ? targetGuild.roles.cache.find((r) => r.name === p.roleName)?.id : null);
        return targetRoleId ? {
          id: targetRoleId,
          type: p.type || 'role',
          allow: BigInt(p.allow),
          deny: BigInt(p.deny)
        } : null;
      }).filter(Boolean);

      const newCategory = await executeWithRetry(
        async () => {
          return await targetGuild.channels.create(catData.name, {
            type: 'GUILD_CATEGORY',
            position: catData.position,
            permissionOverwrites: overwrites,
            reason: 'Viqole Cloner Şablon Geri Yükleme'
          });
        },
        `Kategori Yükleme: ${catData.name}`
      );

      categoryMap.set(catData.originalId, newCategory.id);
      stats.categoriesCreated++;
      logger.info(`Oluşturuldu: [Kategori] 📁 ${catData.name}`);
      await sleep(DELAY_CONFIG.CATEGORY_CREATE);
    } catch (err) {
      logger.error(`Kategori oluşturulamadı (${catData.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // Channels
  for (const chData of backup.channels || []) {
    try {
      const parentId = chData.parentCategoryOriginalId ? categoryMap.get(chData.parentCategoryOriginalId) : null;
      const overwrites = (chData.permissions || []).map((p) => {
        const targetRoleId = roleMap.get(p.id) || (p.roleName ? targetGuild.roles.cache.find((r) => r.name === p.roleName)?.id : null);
        return targetRoleId ? {
          id: targetRoleId,
          type: p.type || 'role',
          allow: BigInt(p.allow),
          deny: BigInt(p.deny)
        } : null;
      }).filter(Boolean);

      const options = {
        type: chData.type,
        parent: parentId || undefined,
        permissionOverwrites: overwrites,
        position: chData.position,
        reason: 'Viqole Cloner Şablon Geri Yükleme'
      };

      if (chData.type === 'GUILD_TEXT' || chData.type === 'GUILD_NEWS') {
        options.topic = chData.topic || undefined;
        options.nsfw = chData.nsfw;
        options.rateLimitPerUser = chData.rateLimitPerUser || 0;
      } else if (chData.type === 'GUILD_VOICE') {
        options.bitrate = Math.min(chData.bitrate || 64000, 64000);
        options.userLimit = chData.userLimit || 0;
      }

      await executeWithRetry(
        async () => {
          return await targetGuild.channels.create(chData.name, options);
        },
        `Kanal Yükleme: ${chData.name}`
      );

      stats.channelsCreated++;
      const icon = chData.type === 'GUILD_VOICE' ? '🔊' : chData.type === 'GUILD_NEWS' ? '📢' : '💬';
      logger.info(`Oluşturuldu: [Kanal] ${icon} ${chData.name}`);
      await sleep(DELAY_CONFIG.CHANNEL_CREATE);
    } catch (err) {
      logger.error(`Kanal oluşturulamadı (${chData.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // Aşama 5: Emojiler
  if (options.restoreEmojis !== false && (backup.emojis || []).length > 0) {
    logger.step(5, 5, 'Özel Emojiler');
    for (const emoji of backup.emojis) {
      if (targetGuild.emojis.cache.some((e) => e.name === emoji.name)) continue;
      try {
        await executeWithRetry(
          async () => {
            return await targetGuild.emojis.create(emoji.data, emoji.name, {
              reason: 'Viqole Cloner Şablon Geri Yükleme'
            });
          },
          `Emoji Yükleme: ${emoji.name}`
        );
        stats.emojisCreated++;
        logger.info(`Oluşturuldu: [Emoji] :${emoji.name}:`);
        await sleep(DELAY_CONFIG.EMOJI_CREATE);
      } catch (err) {
        logger.warn(`Emoji yüklenemedi (:${emoji.name}:): ${err.message}`);
        stats.failed++;
      }
    }
  }

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  stats.elapsedTime = `${elapsedSeconds}s`;

  logger.stats(stats);
  return stats;
}
