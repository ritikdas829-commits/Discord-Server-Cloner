import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

/**
 * Clones roles from source guild to target guild.
 * Returns a Map of sourceRoleId -> targetRoleId for channel permission overwrites mapping.
 */
export async function cloneRoles(sourceGuild, targetGuild, stats) {
  logger.info('Roller taranıyor ve hiyerarşik olarak oluşturuluyor...');

  const roleMap = new Map();

  // 1. Map @everyone role
  const sourceEveryone = sourceGuild.roles.everyone;
  const targetEveryone = targetGuild.roles.everyone;
  roleMap.set(sourceEveryone.id, targetEveryone.id);

  // Update @everyone permissions
  try {
    await executeWithRetry(async () => {
      await targetEveryone.setPermissions(sourceEveryone.permissions.bitfield);
    }, '@everyone İzin Güncelleme');
    logger.success('@everyone rol izinleri eşitlendi.');
  } catch (err) {
    logger.warn(`@everyone izinleri güncellenemedi: ${err.message}`);
  }

  // 2. Filter non-everyone, non-managed roles sorted by position DESCENDING
  // In Discord API, every newly created role is placed at position 1 and pushes existing roles up.
  // By creating roles in descending order (highest to lowest), the highest role ends up at the top
  // and the lowest role ends up at the bottom!
  const sourceRoles = sourceGuild.roles.cache
    .filter((role) => role.name !== '@everyone' && !role.managed)
    .sort((a, b) => b.position - a.position);

  const totalRoles = sourceRoles.size;
  logger.info(`Klonlanacak toplam rol sayısı: ${totalRoles}`);

  let createdCount = 0;
  for (const [, role] of sourceRoles) {
    try {
      const newRole = await executeWithRetry(
        async () => {
          return await targetGuild.roles.create({
            name: role.name,
            color: role.hexColor,
            permissions: role.permissions,
            hoist: role.hoist,
            mentionable: role.mentionable,
            reason: 'Viqole Cloner Tarafından Oluşturuldu'
          });
        },
        `Rol Oluşturma: ${role.name}`
      );

      roleMap.set(role.id, newRole.id);
      stats.rolesCreated++;
      createdCount++;
      logger.info(`[${createdCount}/${totalRoles}] Oluşturuldu: [Rol] ${role.name} (${role.hexColor})`);

      await sleep(DELAY_CONFIG.ROLE_CREATE);
    } catch (error) {
      logger.error(`Rol oluşturulamadı (${role.name}): ${error.message}`);
      stats.failed++;
    }
  }

  // 3. Fix role hierarchy / positions using batch setPositions
  logger.info('Rol hiyerarşisi ve sıralaması senkronize ediliyor...');
  await fixRoleHierarchy(sourceGuild, targetGuild, roleMap);

  logger.success(`Rol klonlama tamamlandı. Toplam: ${stats.rolesCreated} rol.`);
  return roleMap;
}

/**
 * Adjusts target guild roles to match source guild's exact position order.
 */
export async function fixRoleHierarchy(sourceGuild, targetGuild, roleMap) {
  try {
    // Fetch fresh roles from target guild
    await targetGuild.roles.fetch();

    const me = targetGuild.members.resolve(targetGuild.client.user) || targetGuild.members.cache.get(targetGuild.client.user.id);
    const myHighestRolePosition = me ? me.roles.highest.position : 9999;
    const isOwner = targetGuild.ownerId === targetGuild.client.user.id;

    const positionsToSet = [];

    // Map source role positions to target roles
    for (const [, sourceRole] of sourceGuild.roles.cache) {
      if (sourceRole.name === '@everyone' || sourceRole.managed) continue;

      const targetRoleId = roleMap.get(sourceRole.id);
      if (!targetRoleId) continue;

      const targetRole = targetGuild.roles.cache.get(targetRoleId);
      if (targetRole && (isOwner || targetRole.position < myHighestRolePosition)) {
        positionsToSet.push({
          role: targetRole.id,
          position: sourceRole.position
        });
      }
    }

    if (positionsToSet.length > 0) {
      // Sort ascending by position for Discord batch API
      positionsToSet.sort((a, b) => a.position - b.position);

      try {
        await executeWithRetry(
          async () => {
            await targetGuild.roles.setPositions(positionsToSet);
          },
          'Toplu Rol Pozisyon Eşitleme'
        );
        logger.success('Rol hiyerarşisi başarıyla eşitlendi.');
      } catch (err) {
        logger.warn(`Toplu pozisyon ayarlanamadı, sıralama oluşturma esnasında zaten korundu: ${err.message}`);
      }
    }
  } catch (error) {
    logger.warn(`Rol hiyerarşisi ayarlanırken hata: ${error.message}`);
  }
}
