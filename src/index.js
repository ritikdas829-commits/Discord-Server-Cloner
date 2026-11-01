import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } from 'discord.js';
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
const CLIENT_ID = process.env.CLIENT_ID; // Bot ka Application ID (Developer Portal se)

const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot ping'),
  new SlashCommandBuilder().setName('backup').setDescription('Create backup of a server').addStringOption(o => o.setName('guild_id').setDescription('Guild ID (optional)').setRequired(false)),
  new SlashCommandBuilder().setName('clone').setDescription('Clone one server to another')
    .addStringOption(o => o.setName('source_id').setDescription('Source Server ID').setRequired(true))
    .addStringOption(o => o.setName('target_id').setDescription('Target Server ID').setRequired(true)),
].map(c => c.toJSON());

async function deploySlash(token) {
  if (!CLIENT_ID) {
    logger.warn('CLIENT_ID missing in env, slash commands deploy skip (prefix ! still works)');
    return;
  }
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    logger.info('Deploying slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
    logger.success('✅ Slash commands deployed! (/help, /ping, /clone, /backup)');
  } catch (e) {
    logger.error(`Slash deploy fail: ${e.message}`);
  }
}

async function main() {
  showBanner();
  const token = sanitizeToken(process.env.DISCORD_TOKEN);
  if (!token) { logger.error('DISCORD_TOKEN missing!'); process.exit(1); }

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

  // PREFIX (!)
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    if (cmd === 'help') return message.reply('**Commands:** `!help, !ping, !clone <src> <tgt>, !backup [id]` or use `/help`');
    if (cmd === 'ping') return message.reply(`Pong! ${client.ws.ping}ms ✅`);
    if (cmd === 'clone') {
      const [sId, tId] = args;
      if (!sId || !tId) return message.reply('Use: `!clone <sourceId> <targetId>`');
      const sG = client.guilds.cache.get(sId); const tG = client.guilds.cache.get(tId);
      if (!sG || !tG) return message.reply('Bot dono server me nahi hai!');
      await message.reply(`🚀 Cloning ${sG.name} -> ${tG.name}...`);
      try { await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true }); await message.reply('✅ Clone Done!'); }
      catch (e) { await message.reply(`❌ ${e.message}`); }
    }
    if (cmd === 'backup') {
      const gId = args[0] || message.guild?.id; const g = client.guilds.cache.get(gId);
      if (!g) return message.reply('Guild nahi mila');
      await message.reply(`📦 Backup ${g.name}...`);
      try { await createBackup(g, { backupEmojis: true }); await message.reply('✅ Backup Done!'); }
      catch (e) { await message.reply(`❌ ${e.message}`); }
    }
  });

  // SLASH (/)
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    if (commandName === 'help') {
      return interaction.reply('**Commands:**\n`/ping` - check bot\n`/clone source_id:ID target_id:ID` - clone server\n`/backup` - backup server\nPrefix also works: `!help`');
    }
    if (commandName === 'ping') {
      return interaction.reply(`Pong! ${client.ws.ping}ms ✅ Online in ${client.guilds.cache.size} servers`);
    }
    if (commandName === 'backup') {
      await interaction.deferReply();
      const gId = interaction.options.getString('guild_id') || interaction.guildId;
      const g = client.guilds.cache.get(gId);
      if (!g) return interaction.editReply('❌ Guild nahi mila');
      try { await createBackup(g, { backupEmojis: true }); return interaction.editReply(`✅ Backup Done: ${g.name}`); }
      catch (e) { return interaction.editReply(`❌ ${e.message}`); }
    }
    if (commandName === 'clone') {
      await interaction.deferReply();
      const sId = interaction.options.getString('source_id');
      const tId = interaction.options.getString('target_id');
      if (sId === tId) return interaction.editReply('❌ Same ID nahi!');
      const sG = client.guilds.cache.get(sId); const tG = client.guilds.cache.get(tId);
      if (!sG || !tG) return interaction.editReply('❌ Bot dono server me nahi hai! Pehle add karo.');
      await interaction.editReply(`🚀 Cloning **${sG.name}** -> **${tG.name}** ... 2-5 min lagega`);
      try {
        await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true });
        return interaction.editReply(`✅ **Clone Complete!** ${sG.name} -> ${tG.name}`);
      } catch (e) { return interaction.editReply(`❌ Clone Fail: ${e.message}`); }
    }
  });

  client.once('ready', async () => {
    logger.success(`Online as ${chalk.bold.cyan(client.user.tag)}`);
    logger.info(`Prefix: ${PREFIX} | Slash: /help /ping /clone /backup`);
    await deploySlash(token);
  });

  await client.login(token);
}

main().catch(e => { console.error(e); process.exit(1); });
