import { logger } from '../ui/logger.js';
import { clearTargetGuild, cloneGuildSettings } from '../handlers/guild.js';
import { cloneRoles } from '../handlers/roles.js';
import { cloneChannels } from '../handlers/channels.js';
import { cloneEmojis } from '../handlers/emojis.js';
import { cloneChannelMessages } from '../handlers/messages.js';

/**
 * Main Direct Server-to-Server Cloner Orchestrator.
 * @param {Client} client - Discord client
 * @param {string} sourceGuildId - Source Discord server ID
 * @param {string} targetGuildId - Target Discord server ID
 * @param {Object} options - Cloning configuration options
 */
export async function startDirectClone(client, sourceGuildId, targetGuildId, options = {}) {
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

  const totalSteps = options.cloneMessages ? 6 : 5;

  // 1. Fetch guilds and fresh data
  const sourceGuild = client.guilds.cache.get(sourceGuildId);
  const targetGuild = client.guilds.cache.get(targetGuildId);

  if (!sourceGuild) {
    throw new Error(`Kaynak sunucu bulunamadı (${sourceGuildId}). Hesabınızın bu sunucuda olduğundan emin olun!`);
  }

  if (!targetGuild) {
    throw new Error(`Hedef sunucu bulunamadı (${targetGuildId}). Hesabınızın bu sunucuda olduğundan emin olun!`);
  }

  logger.info(`Sunucu verileri Discord API'den tazeleniyor...`);
  try {
    await Promise.all([
      sourceGuild.channels.fetch(),
      sourceGuild.roles.fetch(),
      targetGuild.channels.fetch(),
      targetGuild.roles.fetch(),
      targetGuild.members.fetch(client.user.id)
    ]);
  } catch (err) {
    logger.warn(`Veriler tazelenirken uyarı: ${err.message}`);
  }

  logger.info(`Kaynak Sunucu: "${sourceGuild.name}" (${sourceGuild.id}) [${sourceGuild.roles.cache.size} Rol, ${sourceGuild.channels.cache.size} Kanal]`);
  logger.info(`Hedef Sunucu:  "${targetGuild.name}" (${targetGuild.id}) [${targetGuild.roles.cache.size} Rol, ${targetGuild.channels.cache.size} Kanal]`);

  // 2. Validate permissions
  const targetMember = targetGuild.members.me || targetGuild.members.cache.get(client.user.id);
  if (targetMember && !targetMember.permissions.has('ADMINISTRATOR') && !targetMember.permissions.has('MANAGE_GUILD')) {
    logger.warn('Hedef sunucuda Yönetici (Administrator) yetkiniz olmayabilir. Bazı işlemler başarısız olabilir!');
  }

  // Aşama 1: Temizlik
  if (options.clearTarget !== false) {
    logger.step(1, totalSteps, 'Hedef Sunucu Temizliği');
    await clearTargetGuild(targetGuild, stats);
  }

  // Aşama 2: Sunucu Ayarları ve Görseller
  logger.step(2, totalSteps, 'Sunucu Temel Bilgileri & Medya (İkon/Afiş)');
  await cloneGuildSettings(sourceGuild, targetGuild, options);

  // Aşama 3: Roller ve Hiyerarşi
  logger.step(3, totalSteps, 'Roller ve İzin Hiyerarşisi');
  const roleMap = await cloneRoles(sourceGuild, targetGuild, stats);

  // Aşama 4: Kategoriler ve Kanallar
  logger.step(4, totalSteps, 'Kategoriler, Metin ve Ses Kanalları');
  const channelMap = await cloneChannels(sourceGuild, targetGuild, roleMap, stats);

  // Aşama 5: Emojiler
  if (options.cloneEmojis !== false) {
    logger.step(5, totalSteps, 'Özel Sunucu Emojileri');
    await cloneEmojis(sourceGuild, targetGuild, stats);
  }

  // Aşama 6: Mesajlar (Opsiyonel)
  if (options.cloneMessages) {
    logger.step(6, totalSteps, 'Kanal Mesajları (Webhook)');
    await cloneChannelMessages(sourceGuild, channelMap, options.maxMessagesPerChannel || 10, stats);
  }

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  stats.elapsedTime = `${elapsedSeconds}s`;

  logger.stats(stats);
  return stats;
}
