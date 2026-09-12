import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

/**
 * Clones recent messages from source text channels to newly created target channels using Webhooks.
 * @param {Map<string, Channel>} channelMap - Map of sourceChannelId -> targetChannel
 * @param {number} maxMessages - Maximum messages to clone per channel (e.g., 10)
 * @param {Object} stats - Stats accumulator
 */
export async function cloneChannelMessages(sourceGuild, channelMap, maxMessages = 10, stats) {
  logger.info(`Mesaj kopyalama başlatılıyor (Kanal başına en fazla ${maxMessages} mesaj)...`);

  for (const [sourceId, targetChannel] of channelMap.entries()) {
    if (targetChannel.type !== 'GUILD_TEXT') continue;

    const sourceChannel = sourceGuild.channels.cache.get(sourceId);
    if (!sourceChannel || !sourceChannel.messages) continue;

    try {
      // 1. Fetch recent messages in reverse chronological order
      const fetched = await sourceChannel.messages.fetch({ limit: maxMessages });
      if (!fetched || fetched.size === 0) continue;

      const messages = Array.from(fetched.values()).reverse(); // chronological order

      // 2. Create a temporary webhook in target channel
      let webhook;
      try {
        webhook = await targetChannel.createWebhook('Viqole Cloner', {
          avatar: targetChannel.client.user?.displayAvatarURL?.()
        });
      } catch (err) {
        logger.warn(`Webhook oluşturulamadı (${targetChannel.name}): ${err.message}`);
        continue;
      }

      logger.info(`[Mesaj] ${targetChannel.name} kanalına ${messages.length} mesaj aktarılıyor...`);

      for (const msg of messages) {
        // Skip system messages or empty messages without attachments
        if (msg.system) continue;
        if (!msg.content && msg.attachments.size === 0 && msg.embeds.length === 0) continue;

        try {
          const files = msg.attachments.map((a) => a.url);

          await webhook.send({
            content: msg.content || undefined,
            username: msg.author ? (msg.member?.displayName || msg.author.username) : 'Bilinmeyen Kullanıcı',
            avatarURL: msg.author ? msg.author.displayAvatarURL({ dynamic: true }) : undefined,
            embeds: msg.embeds || [],
            files: files.slice(0, 5) // Send up to 5 files per message
          });

          stats.messagesCloned++;
          await sleep(DELAY_CONFIG.MESSAGE_SEND);
        } catch {
          // Ignore individual message failures
        }
      }

      // 3. Delete temporary webhook
      try {
        await webhook.delete('Mesaj aktarımı tamamlandı');
      } catch {
        // Ignore webhook cleanup error
      }
    } catch (err) {
      logger.warn(`Mesajlar alınamadı (${targetChannel.name}): ${err.message}`);
    }
  }

  logger.success(`Mesaj aktarımı tamamlandı. Toplam: ${stats.messagesCloned} mesaj kopyalandı.`);
}
