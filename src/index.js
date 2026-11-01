import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { input } from '@【entity-inquirer¦canonical_name=inquirer】/prompts';
import chalk from 'chalk';
import { showBanner } from './ui/banner.js';
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

function sanitizeToken(rawToken) {
  if (!rawToken) return '';
  return rawToken.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

const PREFIX = '!';

async function main() {
  showBanner();

  let token = sanitizeToken(process.env.DISCORD_TOKEN);
  if (!token) {
    if (process.env.RENDER || !process.stdin.isTTY) {
      logger.error('DISCORD_TOKEN missing in Environment Variables!');
      process.exit(1);
    }
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
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.GuildMember, Partials.Channel]
  });

  // --- BOT COMMANDS (Discord me kaam karega) ---
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'help') {
      return message.reply(
`**Viqole Cloner - Commands**
\`${PREFIX}help\` - Ye help
\`${PREFIX}ping\` - Bot status
\`${PREFIX}clone <sourceId> <targetId>\` - Clone server
\`${PREFIX}backup [guildId]\` - Backup banao`
      );
    }

    if (command === 'ping') {
      return message.reply(`🏓 Pong! **${client.ws.ping}ms** | Servers: ${client.guilds.cache.size}`);
    }

    if (command === 'clone') {
      const sourceId = args[0];
      const targetId = args[1];
      if (!sourceId || !targetId) return message.reply(`❌ Use: \`${PREFIX}clone <sourceId> <targetId>\``);
      if (sourceId === targetId) return message.reply('❌ Same ID nahi ho sakta!');
      
      const sourceGuild = client.guilds.cache.get(sourceId);
      const targetGuild = client.guilds.cache.get(targetId);
      if (!sourceGuild || !targetGuild) return message.reply('❌ Bot dono server me nahi hai. Invite check karo.');

      await message.reply(`🚀 Cloning: **${sourceGuild.name}** -> **${targetGuild.name}** ...`);
      try {
        await startDirectClone(client, sourceId, targetId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true });
        await message.reply(`✅ Clone Complete!`);
      } catch (err) {
        await message.reply(`❌ Fail: ${err.message}`);
      }
    }

    if (command === 'backup') {
      const guildId = args[0] || message.guild?.id;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return message.reply('❌ Guild nahi mila.');
      await message.reply(`📦 Backup: ${guild.name} ...`);
      try {
        await createBackup(guild, { backupEmojis: true });
        await message.reply(`✅ Backup Done!`);
      } catch (err) {
        await message.reply(`❌ Fail: ${err.message}`);
      }
    }
  });

  logger.info(t('connectingDiscord'));

  try {
    await client.login(token);
  } catch (error) {
    logger.error(`${t('loginFailed')} ${error.message}`);
    if(error.message.toLowerCase().includes('intents')) {
        logger.error('Discord Portal me 3 Intents ON karo: Presence, Server Members, Message Content');
    }
    process.exit(1);
  }

  logger.success(`${t('loginSuccess')} ${chalk.bold.cyan(client.user.tag)} (${client.user.id})`);
  logger.info(`${t('totalGuilds')} ${client.guilds.cache.size}`);
  logger.info(`Commands Active: ${PREFIX}clone, ${PREFIX}backup, ${PREFIX}help, ${PREFIX}ping`);

  // --- AUTO CLONE MODE (Render ke liye) ---
  const autoSource = process.env.SOURCE_GUILD_ID;
  const autoTarget = process.env.TARGET_GUILD_ID;

  if (autoSource && autoTarget) {
    logger.info(`Auto Clone Mode: ${autoSource} -> ${autoTarget}`);
    if (autoSource === autoTarget) {
      logger.error(t('sameGuildError'));
      process.exit(1);
    }
    try {
      const options = { cloneRoles: true, cloneChannels: true, cloneEmojis: true };
      await startDirectClone(client, autoSource, autoTarget, options);
      logger.success('Auto clone completed!');
      // Render pe exit mat karo, bot ko online rehne do commands ke liye
    } catch (err) {
      logger.error(`Klonlama hatası: ${err.message}`);
    }
  }

  // --- LOCAL MENU MODE (PC pe chalane ke liye) ---
  if (!process.env.SOURCE_GUILD_ID && process.stdin.isTTY && !process.env.RENDER) {
    let running = true;
    while (running) {
      console.log('');
      const action = await promptMainMenu();
      switch (action) {
        case 'DIRECT_CLONE': {
          const sourceGuildId = await promptSelectGuild(client, t('selectSourceGuild'), false);
          const targetGuildId = await promptSelectGuild(client, t('selectTargetGuild'), true);
          if (sourceGuildId === targetGuildId) { logger.error(t('sameGuildError')); break; }
          const options = await promptCloneOptions();
          try { await startDirectClone(client, sourceGuildId, targetGuildId, options); } catch (err) { logger.error(`Hata: ${err.message}`); }
          break;
        }
        case 'CREATE_BACKUP': {
          const sourceGuildId = await promptSelectGuild(client, t('selectBackupSource'), false);
          const sourceGuild = client.guilds.cache.get(sourceGuildId);
          if (!sourceGuild) { logger.error(t('sourceNotFound')); break; }
          try { await createBackup(sourceGuild, { backupEmojis: true }); } catch (err) { logger.error(`Hata: ${err.message}`); }
          break;
        }
        case 'RESTORE_BACKUP': {
          const backupFile = await promptSelectBackupFile();
          if (!backupFile) { logger.warn(t('noBackupsFound')); break; }
          const targetGuildId = await promptSelectGuild(client, t('selectRestoreTarget'), true);
          const targetGuild = client.guilds.cache.get(targetGuildId);
          if (!targetGuild) { logger.error(t('targetNotFound')); break; }
          try { await restoreBackup(backupFile, targetGuild, { clearBeforeRestore: true, restoreEmojis: true }); } catch (err) { logger.error(`Hata: ${err.message}`); }
          break;
        }
        case 'CHANGE_LANG': {
          const current = getLanguage();
          const next = current === 'tr' ? 'en' : 'tr';
          setLanguage(next);
          showBanner();
          logger.success(next === 'en' ? 'Language: English' : 'Dil: Türkçe');
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
  } else {
    logger.info('Bot is now online and listening for commands. Use !help in Discord.');
  }
}

process.on('unhandledRejection', (reason) => {
  if (reason?.code === 50013) {
    logger.warn('Missing Permissions: Bot ko Administrator do.');
  } else {
    logger.warn(`Error: ${reason?.message || reason}`);
  }
});

main().catch((err) => {
  logger.error(`Critical Error: ${err.message}`);
  process.exit(1);
});
