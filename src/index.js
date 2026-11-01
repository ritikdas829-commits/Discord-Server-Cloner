import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import chalk from 'chalk';
import { showBanner } from './ui/banner.js';
import { logger } from './ui/logger.js';
import { startDirectClone } from './core/cloner.js';
import { createBackup } from './core/backup.js';

function sanitizeToken(rawToken) {
  if (!rawToken) return '';
  return rawToken.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

const PREFIX = '!';

async function main() {
  showBanner();
  const token = sanitizeToken(process.env.【entity-DISCORD_TOKEN¦canonical_name=Discord】);
  if (!token) {
    logger.error('【entity-DISCORD_TOKEN¦canonical_name=Discord】 missing!');
    process.exit(1);
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

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'help') {
      return message.reply(`**Commands:**\n\`!help\` - help\n\`!ping\` - check bot\n\`!clone <sourceId> <targetId>\` - clone server\n\`!backup [guildId]\` - backup`);
    }
    if (cmd === 'ping') {
      return message.reply(`Pong! ${client.ws.ping}ms - Online ✅`);
    }
    if (cmd === 'clone') {
      const [sId, tId] = args;
      if (!sId || !tId) return message.reply('Use: `!clone <sourceId> <targetId>`');
      const sG = client.guilds.cache.get(sId);
      const tG = client.guilds.cache.get(tId);
      if (!sG || !tG) return message.reply('Bot dono server me nahi hai!');
      await message.reply(`🚀 Cloning ${sG.name} -> ${tG.name}...`);
      try {
        await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true });
        await message.reply('✅ Clone Done!');
      } catch (e) {
        await message.reply(`❌ ${e.message}`);
      }
    }
    if (cmd === 'backup') {
      const gId = args[0] || message.guild?.id;
      const g = client.guilds.cache.get(gId);
      if (!g) return message.reply('Guild nahi mila');
      await message.reply(`📦 Backup ${g.name}...`);
      try {
        await createBackup(g, { backupEmojis: true });
        await message.reply('✅ Backup Done!');
      } catch (e) {
        await message.reply(`❌ ${e.message}`);
      }
    }
  });

  client.once('ready', () => {
    logger.success(`Online as ${chalk.bold.cyan(client.user.tag)}`);
    logger.info(`Use !help in Discord`);
  });

  // Auto clone if env vars present
  client.once('ready', async () => {
    const src = process.env.SOURCE_GUILD_ID;
    const trg = process.env.TARGET_GUILD_ID;
    if (src && trg && src !== trg) {
      logger.info(`Auto Clone: ${src} -> ${trg}`);
      try {
        await startDirectClone(client, src, trg, { cloneRoles: true, cloneChannels: true, cloneEmojis: true });
        logger.success('Auto Clone Complete!');
      } catch (e) { logger.error(`Auto Clone Fail: ${e.message}`); }
    }
  });

  await client.login(token);
}

main().catch(e => { console.error(e); process.exit(1); });
