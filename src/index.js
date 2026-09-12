import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { showBanner, viqoleGradient } from './ui/banner.js';
import { logger } from './ui/logger.js';
import {
  promptMainMenu,
  promptSelectGuild,
  promptCloneOptions,
  promptSelectBackupFile
} from './ui/prompts.js';
import { startDirectClone } from './core/cloner.js';
import { createBackup } from './core/backup.js';
import { restoreBackup } from './core/restore.js';
import { t, setLanguage, getLanguage } from './i18n/index.js';

/**
 * Sanitizes input token by trimming and removing wrapping quotes or backticks
 */
function sanitizeToken(rawToken) {
  if (!rawToken) return '';
  return rawToken.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

async function main() {
  showBanner();

  let token = sanitizeToken(process.env.DISCORD_TOKEN);

  if (!token) {
    logger.warn(t('tokenMissingEnv'));
    token = await input({
      message: t('tokenPrompt'),
      validate: (val) => {
        const clean = sanitizeToken(val);
        return clean.length > 20 ? true : t('tokenInvalid');
      }
    });
    token = sanitizeToken(token);
  }

  const client = new Client({
    checkUpdate: false
  });

  logger.info(t('connectingDiscord'));

  try {
    await client.login(token);
  } catch (error) {
    logger.error(`${t('loginFailed')} ${error.message}`);
    process.exit(1);
  }

  logger.success(`${t('loginSuccess')} ${chalk.bold.cyan(client.user.tag)} (${client.user.id})`);
  logger.info(`${t('totalGuilds')} ${client.guilds.cache.size}`);

  let running = true;
  while (running) {
    console.log('');
    const action = await promptMainMenu();

    switch (action) {
      case 'DIRECT_CLONE': {
        const sourceGuildId = await promptSelectGuild(client, t('selectSourceGuild'), false);
        const targetGuildId = await promptSelectGuild(client, t('selectTargetGuild'), true);

        if (sourceGuildId === targetGuildId) {
          logger.error(t('sameGuildError'));
          break;
        }

        const options = await promptCloneOptions();
        try {
          await startDirectClone(client, sourceGuildId, targetGuildId, options);
        } catch (err) {
          logger.error(`Klonlama hatası: ${err.message}`);
        }
        break;
      }

      case 'CREATE_BACKUP': {
        const sourceGuildId = await promptSelectGuild(client, t('selectBackupSource'), false);
        const sourceGuild = client.guilds.cache.get(sourceGuildId);
        if (!sourceGuild) {
          logger.error(t('sourceNotFound'));
          break;
        }

        try {
          await createBackup(sourceGuild, { backupEmojis: true });
        } catch (err) {
          logger.error(`Şablon oluşturulamadı: ${err.message}`);
        }
        break;
      }

      case 'RESTORE_BACKUP': {
        const backupFile = await promptSelectBackupFile();
        if (!backupFile) {
          logger.warn(t('noBackupsFound'));
          break;
        }

        const targetGuildId = await promptSelectGuild(client, t('selectRestoreTarget'), true);
        const targetGuild = client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
          logger.error(t('targetNotFound'));
          break;
        }

        try {
          await restoreBackup(backupFile, targetGuild, { clearBeforeRestore: true, restoreEmojis: true });
        } catch (err) {
          logger.error(`Şablon geri yüklenemedi: ${err.message}`);
        }
        break;
      }

      case 'CHANGE_LANG': {
        const current = getLanguage();
        const next = current === 'tr' ? 'en' : 'tr';
        setLanguage(next);
        showBanner();
        logger.success(next === 'en' ? 'Language switched to: English (US)' : 'Dil değiştirildi: Türkçe');
        break;
      }

      case 'EXIT': {
        running = false;
        logger.info(t('exitMessage'));
        client.destroy();
        process.exit(0);
      }
    }
  }
}

process.on('unhandledRejection', (reason) => {
  if (reason?.code === 50013) {
    logger.warn('Discord Yetki Hatası (Missing Permissions): Bot veya kullanıcı hesabının bu işlem için yetkisi yetersiz.');
  } else {
    logger.warn(`İşlenmemiş Hata: ${reason?.message || reason}`);
  }
});

main().catch((err) => {
  logger.error(`Kritik Başlatma Hatası: ${err.message}`);
  process.exit(1);
});
