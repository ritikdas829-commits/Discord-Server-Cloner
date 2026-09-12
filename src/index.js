import 'dotenv/config';
import { Client } from 'discord.js-selfbot-v13';
import { input, confirm } from '@inquirer/prompts';
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
    logger.warn('.env dosyasında DISCORD_TOKEN bulunamadı.');
    token = await input({
      message: 'Lütfen Discord Tokeninizi girin (User Token veya Bot Token):',
      validate: (val) => {
        const clean = sanitizeToken(val);
        return clean.length > 20 ? true : 'Geçerli bir token giriniz!';
      }
    });
    token = sanitizeToken(token);
  }

  const client = new Client({
    checkUpdate: false
  });

  logger.info('Discord sunucularına bağlanılıyor...');

  try {
    await client.login(token);
  } catch (error) {
    logger.error(`Giriş başarısız! Token geçersiz veya Discord erişimi engellendi: ${error.message}`);
    process.exit(1);
  }

  logger.success(`Başarıyla giriş yapıldı: ${chalk.bold.cyan(client.user.tag)} (${client.user.id})`);
  logger.info(`Hesabın bulunduğu toplam sunucu sayısı: ${client.guilds.cache.size}`);

  let running = true;
  while (running) {
    console.log('');
    const action = await promptMainMenu();

    switch (action) {
      case 'DIRECT_CLONE': {
        const sourceGuildId = await promptSelectGuild(client, 'Kaynak Sunucuyu Seçin (Kopyalanacak Sunucu):', false);
        const targetGuildId = await promptSelectGuild(client, 'Hedef Sunucuyu Seçin (Klonun Yapılacağı Sunucu):', true);

        if (sourceGuildId === targetGuildId) {
          logger.error('Kaynak ve hedef sunucu aynı olamaz!');
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
        const sourceGuildId = await promptSelectGuild(client, 'Şablonu çıkarılacak sunucuyu seçin:', false);
        const sourceGuild = client.guilds.cache.get(sourceGuildId);
        if (!sourceGuild) {
          logger.error('Sunucu bulunamadı!');
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
          logger.warn('backups/ klasöründe herhangi bir .json şablon dosyası bulunamadı!');
          break;
        }

        const targetGuildId = await promptSelectGuild(client, 'Şablonun kurulacağı hedef sunucuyu seçin:', true);
        const targetGuild = client.guilds.cache.get(targetGuildId);
        if (!targetGuild) {
          logger.error('Hedef sunucu bulunamadı!');
          break;
        }

        try {
          await restoreBackup(backupFile, targetGuild, { clearBeforeRestore: true, restoreEmojis: true });
        } catch (err) {
          logger.error(`Şablon geri yüklenemedi: ${err.message}`);
        }
        break;
      }

      case 'EXIT': {
        running = false;
        logger.info('Viqole Cloner kapatılıyor. İyi günler dileriz!');
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
