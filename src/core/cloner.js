import { logger } from '../ui/logger.js';
import { clearTargetGuild, cloneGuildSettings } from '../handlers/guild.js';
import { cloneRoles } from '../handlers/roles.js';
import { cloneChannels } from '../handlers/channels.js';
import { cloneEmojis } from '../handlers/emojis.js';
import { cloneChannelMessages } from '../handlers/messages.js';
import { t } from '../i18n/index.js';

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

  // FIXED: cache.get ki jagah fetch use kar rahe hai
  let sourceGuild = await client.guilds.fetch(sourceGuildId).catch(() => client.guilds.cache.get(sourceGuildId));
  let targetGuild = await client.guilds.fetch(targetGuildId).catch(() => client.guilds.cache.get(targetGuildId));

  if (!sourceGuild) {
    throw new Error(`Kaynak sunucu bulunamadı (${sourceGuildId}). Bot us server me nahi hai!`);
  }
  if (!targetGuild) {
    throw new Error(`Hedef sunucu bulunamadı (${targetGuildId}). Bot us server me nahi hai!`);
  }

  logger.info(`Sunucu verileri Discord API'den tazeleniyor...`);
  try {
    await Promise.all([
      sourceGuild.roles.fetch(),
      sourceGuild.channels.fetch(),
      sourceGuild.emojis.fetch().catch(()=>{}),
      targetGuild.roles.fetch(),
      targetGuild.channels.fetch(),
      targetGuild.members.fetch(client.user.id).catch(()=>{})
    ]);
  } catch (err) {
    logger.warn(`Veriler tazelenirken uyarı: ${err.message}`);
  }

  logger.info(`Kaynak: "${sourceGuild.name}" (${sourceGuild.id}) [${sourceGuild.roles.cache.size} Rol, ${sourceGuild.channels.cache.size} Kanal, ${sourceGuild.emojis.cache.size} Emoji]`);
  logger.info(`Hedef:  "${targetGuild.name}" (${targetGuild.id})`);

  // Validate permissions
  const targetMember = targetGuild.members.me || targetGuild.members.cache.get(client.user.id);
  if (targetMember && !targetMember.permissions.has('ADMINISTRATOR')) {
    logger.warn('Hedef sunucuda Administrator nahi hai, kuch fail ho sakta hai!');
  }

  // Stage 1: Cleaning - FIXED: Apne command wale channel ko delete mat karo
  if (options.clearTarget !== false) {
    logger.step(1, totalSteps, t('stepCleaning'));
    // agar !clone wala channel target me hai to usko skip karo taaki ChannelNotCached error na aaye
    await clearTargetGuild(targetGuild, stats, options.protectedChannelId);
  }

  // Stage 2: Settings
  logger.step(2, totalSteps, t('stepSettings'));
  await cloneGuildSettings(sourceGuild, targetGuild, options);

  // Stage 3: Roles
  logger.step(3, totalSteps, t('stepRoles'));
  const roleMap = await cloneRoles(sourceGuild, targetGuild, stats);

  // Stage 4: Channels
  logger.step(4, totalSteps, t('stepChannels'));
  const channelMap = await cloneChannels(sourceGuild, targetGuild, roleMap, stats);

  // Stage 5: Emojis
  if (options.cloneEmojis !== false) {
    logger.step(5, totalSteps, t('stepEmojis'));
    await cloneEmojis(sourceGuild, targetGuild, stats);
  }

  // Stage 6: Messages
  if (options.cloneMessages) {
    logger.step(6, totalSteps, t('stepMessages'));
    await cloneChannelMessages(sourceGuild, channelMap, options.maxMessagesPerChannel || 10, stats);
  }

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  stats.elapsedTime = `${elapsedSeconds}s`;

  logger.stats(stats);
  return stats;
}
