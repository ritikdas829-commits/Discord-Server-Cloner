import axios from 'axios';
import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

/**
 * Downloads an image from a URL and converts it to a base64 Data URI
 */
export async function downloadImageAsBase64(url) {
  if (!url) return null;
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/png';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    logger.warn(`Görsel indirilemedi (${url}): ${error.message}`);
    return null;
  }
}

/**
 * Clean all existing channels and roles from target guild
 */
export async function clearTargetGuild(targetGuild, stats) {
  logger.info(`Hedef sunucu (${targetGuild.name}) taranıyor ve temizleniyor...`);

  // 1. Ensure fresh channels, roles, and current member cache
  try {
    await targetGuild.channels.fetch();
  } catch {}
  try {
    await targetGuild.roles.fetch();
  } catch {}
  try {
    await targetGuild.members.fetch(targetGuild.client.user.id);
  } catch {}

  const me = targetGuild.members.resolve(targetGuild.client.user) || targetGuild.members.cache.get(targetGuild.client.user.id);
  const myHighestRolePosition = me ? me.roles.highest.position : 9999;
  const isOwner = targetGuild.ownerId === targetGuild.client.user.id;

  // 2. Delete all channels: regular channels first, then categories
  const allChannels = Array.from(targetGuild.channels.cache.values());
  const regularChannels = allChannels.filter((ch) => ch.type !== 'GUILD_CATEGORY');
  const categoryChannels = allChannels.filter((ch) => ch.type === 'GUILD_CATEGORY');

  logger.info(`Temizlenecek toplam kanal: ${allChannels.length}`);

  for (const channel of [...regularChannels, ...categoryChannels]) {
    // Skip community rules and public updates channels
    if (targetGuild.rulesChannelId === channel.id || targetGuild.publicUpdatesChannelId === channel.id) {
      continue;
    }

    try {
      await executeWithRetry(
        async () => {
          await channel.delete('Viqole Cloner Temizliği');
        },
        `Kanal Silme: ${channel.name}`
      );
      logger.info(`Silindi: [Kanal] ${channel.name}`);
      await sleep(DELAY_CONFIG.CHANNEL_DELETE);
    } catch (err) {
      logger.warn(`Kanal silinemedi (${channel.name}): ${err.message}`);
      stats.failed++;
    }
  }

  // 3. Delete all roles (excluding @everyone, managed bot roles, and higher roles if not owner)
  const roles = Array.from(targetGuild.roles.cache.values()).filter(
    (r) => r.name !== '@everyone' && !r.managed && r.id !== targetGuild.id && (isOwner || r.position < myHighestRolePosition)
  );

  logger.info(`Temizlenecek toplam rol: ${roles.length}`);

  for (const role of roles) {
    try {
      await executeWithRetry(
        async () => {
          await role.delete('Viqole Cloner Temizliği');
        },
        `Rol Silme: ${role.name}`
      );
      logger.info(`Silindi: [Rol] ${role.name}`);
      await sleep(DELAY_CONFIG.ROLE_DELETE);
    } catch (err) {
      logger.warn(`Rol silinemedi (${role.name}): ${err.message}`);
      stats.failed++;
    }
  }

  logger.success('Hedef sunucu temizliği tamamlandı.');
}

/**
 * Clone or apply server settings (name, icon, banner, splash, verification, etc.)
 */
export async function cloneGuildSettings(sourceGuild, targetGuild, options = {}) {
  logger.info(`Sunucu genel ayarları ve görseller aktarılıyor...`);

  try {
    // 1. Name
    await executeWithRetry(async () => {
      await targetGuild.setName(sourceGuild.name);
    }, 'Sunucu İsmi Değiştirme');
    logger.success(`Sunucu ismi güncellendi: ${sourceGuild.name}`);

    // 2. Icon
    if (options.cloneIcon !== false && sourceGuild.iconURL()) {
      const iconUrl = sourceGuild.iconURL({ format: 'png', dynamic: true, size: 1024 });
      const iconData = await downloadImageAsBase64(iconUrl);
      if (iconData) {
        try {
          await executeWithRetry(async () => {
            await targetGuild.setIcon(iconData);
          }, 'Sunucu İkonu Güncelleme');
          logger.success('Sunucu simgesi (ikonu) başarıyla aktarıldı.');
        } catch (err) {
          logger.warn(`Sunucu ikonu ayarlanamadı: ${err.message}`);
        }
      }
    }

    // 3. Banner (requires server boost tier)
    if (options.cloneBanner !== false && sourceGuild.bannerURL()) {
      const bannerUrl = sourceGuild.bannerURL({ format: 'png', size: 1024 });
      const bannerData = await downloadImageAsBase64(bannerUrl);
      if (bannerData) {
        try {
          await targetGuild.setBanner(bannerData);
          logger.success('Sunucu afişi (banner) aktarıldı.');
        } catch (err) {
          logger.warn(`Sunucu afişi ayarlanamadı (hedef sunucunun Takviye/Boost seviyesi yetersiz olabilir).`);
        }
      }
    }

    // 4. Splash (davet arka planı - requires boost)
    if (sourceGuild.splashURL()) {
      const splashUrl = sourceGuild.splashURL({ format: 'png', size: 1024 });
      const splashData = await downloadImageAsBase64(splashUrl);
      if (splashData) {
        try {
          await targetGuild.setSplash(splashData);
          logger.success('Sunucu davet arka planı (splash) aktarıldı.');
        } catch {
          // Boost seviyesi gerekebilir, sessiz geç
        }
      }
    }

    // 5. Verification level & Content Filter
    try {
      if (sourceGuild.verificationLevel) {
        await targetGuild.setVerificationLevel(sourceGuild.verificationLevel);
      }
      if (sourceGuild.defaultMessageNotifications) {
        await targetGuild.setDefaultMessageNotifications(sourceGuild.defaultMessageNotifications);
      }
      if (sourceGuild.explicitContentFilter && targetGuild.features.includes('COMMUNITY')) {
        await targetGuild.setExplicitContentFilter(sourceGuild.explicitContentFilter);
      }
    } catch {
      // Ignore if tier or community restriction
    }

    await sleep(DELAY_CONFIG.GUILD_EDIT);
  } catch (error) {
    logger.error(`Sunucu ayarları aktarılırken hata oluştu: ${error.message}`);
  }
}
