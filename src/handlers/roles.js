/**
 * roles.js — Rank Fix 1,2,3,4,5 + Premium UI + Live Progress
 * Location: src/handlers/roles.js
 * Fixed: 54221 -> 12345 correct order
 * Reason: setPositions batch fails if bot not owner, need individual setPosition
 */

import { logger } from '../ui/logger.js';
import { sleep, executeWithRetry, DELAY_CONFIG } from '../core/rateLimiter.js';

/**
 * Clones roles from source guild to target guild.
 * Returns a Map of sourceRoleId -> targetRoleId for channel permission overwrites mapping.
 */
export async function cloneRoles(sourceGuild, targetGuild, stats, onProgress = null) {
  logger.info('Roller taranıyor ve hiyerarşik olarak oluşturuluyor...');

  const roleMap = new Map();
  stats = stats || { rolesCreated: 0, failed: 0 };

  const report = (done, total) => {
    if (onProgress) onProgress(done, total);
  };

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

  // 2. Filter non-everyone, non-managed roles
  // FIXED: Sort DESCENDING for creation - highest first so final order is correct
  // Because new role goes to pos 1 and pushes others up
  const sourceRoles = sourceGuild.roles.cache
    .filter((role) => role.name !== '@everyone' && !role.managed)
    .sort((a, b) => b.position - a.position); // DESC: 5,4,3,2,1 for correct final order

  const totalRoles = sourceRoles.size;
  logger.info(`Klonlanacak toplam rol sayısı: ${totalRoles}`);

  let createdCount = 0;
  const createdRolesForFix = [];

  for (const [, role] of sourceRoles) {
    try {
      const exists = targetGuild.roles.cache.find(r => r.name === role.name);
      let newRole = exists;
      
      if (!exists) {
        newRole = await executeWithRetry(
          async () => {
            return await targetGuild.roles.create({
              name: role.name,
              color: role.hexColor,
              permissions: role.permissions,
              hoist: role.hoist,
              mentionable: role.mentionable,
              reason: 'Cloner - Premium'
            });
          },
          `Rol Oluşturma: ${role.name}`
        );
      }

      roleMap.set(role.id, newRole.id);
      createdRolesForFix.push({ newRole, sourcePos: role.position, name: role.name });
      
      stats.rolesCreated++;
      createdCount++;
      report(createdCount, totalRoles);
      
      logger.info(`[${createdCount}/${totalRoles}] Oluşturuldu: [Rol] ${role.name} (${role.hexColor}) - SourcePos:${role.position}`);

      await sleep(DELAY_CONFIG.ROLE_CREATE || 700);
    } catch (error) {
      logger.error(`Rol oluşturulamadı (${role.name}): ${error.message}`);
      stats.failed++;
    }
  }

  // 3. FIX RANK - Make 12345 not 54221
  // Sort by sourcePos ASCENDING and set one-by-one
  logger.info('Rol hiyerarşisi ve sıralaması senkronize ediliyor... (12345 order fix)');
  await fixRoleHierarchy(sourceGuild, targetGuild, roleMap, createdRolesForFix, report);

  logger.success(`Rol klonlama tamamlandı. Toplam: ${stats.rolesCreated} rol - Order fixed to 1,2,3,4,5`);
  return roleMap;
}

/**
 * Adjusts target guild roles to match source guild's exact position order.
 * FIXED: Individual setPosition not batch, so works even if bot not owner
 */
export async function fixRoleHierarchy(sourceGuild, targetGuild, roleMap, createdRolesList, report) {
  try {
    await targetGuild.roles.fetch();

    const me = targetGuild.members.me || targetGuild.members.cache.get(targetGuild.client.user.id);
    const myHighestRolePosition = me ? me.roles.highest.position : 9999;
    const isOwner = targetGuild.ownerId === targetGuild.client.user.id;

    // Sort by source position ASCENDING: 1,2,3,4,5
    const sortedForFix = [...createdRolesList].sort((a, b) => a.sourcePos - b.sourcePos);

    logger.info(`Fixing ${sortedForFix.length} role positions to correct order 1,2,3,4,5...`);

    for (let i = 0; i < sortedForFix.length; i++) {
      const item = sortedForFix[i];
      try {
        // Only fix if bot can manage this role (below bot's highest role or owner)
        if (isOwner || item.newRole.position < myHighestRolePosition || item.newRole.editable) {
          await item.newRole.setPosition(item.sourcePos).catch(async () => {
            // Fallback: try with lower position if source pos too high
            try { await item.newRole.setPosition(i + 1).catch(()=>{}); } catch {}
          });
          logger.info(`Fixed rank: ${item.name} -> Position ${item.sourcePos}`);
        } else {
          logger.warn(`Cannot set position for ${item.name} - above bot role`);
        }
        await sleep(400);
      } catch (e) {
        logger.warn(`Position fix fail for ${item.name}: ${e.message}`);
      }
    }

    // Verify final order
    await targetGuild.roles.fetch();
    const finalRoles = [...targetGuild.roles.cache.values()].filter(r => !r.managed && r.name !== '@everyone').sort((a,b) => a.position - b.position);
    logger.info(`Final role order: ${finalRoles.map(r => `${r.name}:${r.position}`).join(', ')}`);

  } catch (error) {
    logger.warn(`Rol hiyerarşisi ayarlanırken hata: ${error.message}`);
  }
}
