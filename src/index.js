import 'dotenv/config';
import http from 'http';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder } from '【entity-discord¦canonical_name=Discord】.js';
import chalk from 'chalk';
import { showBanner } from './ui/banner.js';
import { logger } from './ui/logger.js';
import { startDirectClone } from './core/cloner.js';
import { createBackup } from './core/backup.js';

// Fix for Render "No open ports" crash - keeps bot online 24/7
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is Online - Server cloner is running');
}).listen(process.env.PORT || 3000);

function sanitizeToken(rawToken) {
  if (!rawToken) return '';
  return rawToken.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

const PREFIX = '!';
const CLIENT_ID = process.env.CLIENT_ID;

const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('Show help menu and command guide'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot latency and status'),
  new SlashCommandBuilder().setName('backup').setDescription('Create a backup of a server').addStringOption(o => o.setName('guild_id').setDescription('Guild ID to backup (optional)').setRequired(false)),
  new SlashCommandBuilder().setName('clone').setDescription('Clone a server to another server')
    .addStringOption(o => o.setName('source_id').setDescription('Source Server ID (copy from)').setRequired(true))
    .addStringOption(o => o.setName('target_id').setDescription('Target Server ID (paste to)').setRequired(true)),
].map(c => c.toJSON());

async function deploySlash(token) {
  if (!CLIENT_ID) {
    logger.warn('CLIENT_ID not found in env - slash commands will be skipped (prefix ! still works)');
    return;
  }
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    logger.info('Deploying slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
    logger.success('✅ Slash commands deployed globally: /help /ping /clone /backup');
  } catch (e) {
    logger.error(`Slash deploy failed: ${e.message}`);
  }
}

function getHelpEmbed(client) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'Viqole - Next-Gen Server Cloner', iconURL: client.user.displayAvatarURL(), url: 'https://github.com/viqole' })
    .setTitle('📚 Command Guide & Help Menu')
    .setDescription('Fast, reliable and secure server cloner. Clone roles, channels, categories, emojis, server icon and name.')
    .setThumbnail(client.user.displayAvatarURL({ size: 1024 }))
    .addFields(
      {
        name: '⌨️ Prefix Commands (Instant)',
        value: '`!help` - Show this help menu\n`!ping` - Check bot latency\n`!clone <sourceId> <targetId>` - Clone server\n`!backup [guildId]` - Create backup',
        inline: false
      },
      {
        name: '🔷 Slash Commands (Global)',
        value: '`/help` - Show this help menu\n`/ping` - Check bot latency\n`/clone source_id:ID target_id:ID` - Clone server\n`/backup guild_id:ID` - Create backup',
        inline: false
      },
      {
        name: '🚀 How to Clone? (Step-by-Step Guide)',
        value: '**Step 1:** Invite bot to BOTH servers with **Administrator** permission.\n**Step 2:** Enable **Developer Mode** in 【entity-Discord¦canonical_name=Discord】 Settings > Advanced.\n**Step 3:** Right-click on Source Server > Copy ID, Right-click on Target Server > Copy ID.\n**Step 4:** Run `!clone SOURCE_ID TARGET_ID` or `/clone source_id:SOURCE_ID target_id:TARGET_ID`\n**Example:** `!clone 123456789012345678 987654321098765432`',
        inline: false
      },
      {
        name: '⚠️ Requirements',
        value: '• Bot must be in both Source & Target servers\n• Bot needs **Administrator** in Target server\n• Target server channels may be deleted if clear is enabled',
        inline: false
      }
    )
    .setFooter({ text: `Bot: ${client.user.tag} | Total Servers: ${client.guilds.cache.size} | Prefix: ${PREFIX} | Made by viqole`, iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

async function main() {
  showBanner();
  const token = sanitizeToken(process.env.DISCORD_TOKEN);
  if (!token) { logger.error('DISCORD_TOKEN is missing in Environment Variables!'); process.exit(1); }

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

  // Prefix Commands (!)
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    const context = {
      reply: (data) => message.reply(data).catch(()=>{}),
      followUp: (data) => message.channel.send(data).catch(()=> message.author.send(data).catch(()=>{})),
      guildId: message.guild?.id,
      protectedChannelId: message.channel.id,
    };

    try {
      if (cmd === 'help') {
        return context.reply({ embeds: [getHelpEmbed(client)] });
      }
      if (cmd === 'ping') {
        const embed = new EmbedBuilder().setColor(0x57F287).setTitle('🏓 Pong!').setDescription(`**Latency:** ${client.ws.ping}ms\n**Uptime:** Online ✅\n**Servers:** ${client.guilds.cache.size}\n**Prefix:** ${PREFIX} | **Slash:** /`).setTimestamp();
        return context.reply({ embeds: [embed] });
      }
      if (cmd === 'clone') {
        const [sId, tId] = args;
        if (!sId || !tId) return context.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ **Usage:** `!clone <sourceId> <targetId>`\n**Example:** `!clone 123456789012345678 987654321098765432`')] });
        const sG = await client.guilds.fetch(sId).catch(()=>null);
        const tG = await client.guilds.fetch(tId).catch(()=>null);
        if (!sG || !tG) return context.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Bot is not in both servers! Please invite bot with Administrator permission to both Source and Target.')] });
        await context.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('🚀 Cloning Started').setDescription(`**Source:** ${sG.name} (\`${sId}\`)\n**Target:** ${tG.name} (\`${tId}\`)\n\nPlease wait 2-5 minutes... Do not delete channels during cloning.`).setTimestamp()] });
        try {
          await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true, protectedChannelId: context.protectedChannelId });
          await context.followUp({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('✅ Clone Completed').setDescription(`Successfully cloned **${sG.name}** to **${tG.name}**\nRoles, Categories, Channels & Emojis have been cloned.`).setTimestamp()] });
        } catch (e) { await context.followUp({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ **Clone Failed:** ${e.message}`)] }); }
      }
      if (cmd === 'backup') {
        const gId = args[0] || message.guild?.id;
        const g = await client.guilds.fetch(gId).catch(()=>null);
        if (!g) return context.reply('❌ Guild not found');
        await context.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`📦 Creating backup for **${g.name}**...`)] });
        try { await createBackup(g, { backupEmojis: true }); await context.followUp({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ Backup completed for **${g.name}**`)] }); }
        catch (e) { await context.followUp(`❌ ${e.message}`); }
      }
    } catch (e) { logger.error(e.message); }
  });

  // Slash Commands (/)
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction.commandName;
    const context = {
      reply: (data) => interaction.reply(data).catch(()=>{}),
      followUp: (data) => interaction.followUp(data).catch(()=>{}),
      guildId: interaction.guildId,
      protectedChannelId: null,
    };
    await interaction.deferReply().catch(()=>{});
    try {
      if (cmd === 'help') return context.reply({ embeds: [getHelpEmbed(client)] });
      if (cmd === 'ping') {
        const embed = new EmbedBuilder().setColor(0x57F287).setTitle('🏓 Pong!').setDescription(`**Latency:** ${client.ws.ping}ms\n**Servers:** ${client.guilds.cache.size}`).setTimestamp();
        return context.reply({ embeds: [embed] });
      }
      if (cmd === 'backup') {
        const gId = interaction.options.getString('guild_id') || interaction.guildId;
        const g = await client.guilds.fetch(gId).catch(()=>null);
        if (!g) return context.reply('❌ Guild not found');
        await context.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(`📦 Backup: ${g.name}...`)] });
        try { await createBackup(g, { backupEmojis: true }); await context.followUp({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ Backup Done: ${g.name}`)] }); }
        catch (e) { await context.followUp(`❌ ${e.message}`); }
      }
      if (cmd === 'clone') {
        const sId = interaction.options.getString('source_id');
        const tId = interaction.options.getString('target_id');
        if (sId === tId) return context.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Source and Target ID cannot be same!')] });
        const sG = await client.guilds.fetch(sId).catch(()=>null);
        const tG = await client.guilds.fetch(tId).catch(()=>null);
        if (!sG || !tG) return context.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Bot is not in both servers!')] });
        await context.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('🚀 Cloning...').setDescription(`**${sG.name}** -> **${tG.name}**\nPlease wait...`)] });
        try {
          await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true });
          await context.followUp({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('✅ Clone Completed').setDescription(`Cloned ${sG.name} to ${tG.name}`)] });
        } catch (e) { await context.followUp({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ Fail: ${e.message}`)] }); }
      }
    } catch (e) { logger.error(e.message); }
  });

  client.once('ready', async () => {
    logger.success(`Online as ${chalk.bold.cyan(client.user.tag)} (${client.user.id})`);
    logger.info(`Prefix: ${PREFIX} | Slash: /help /ping /clone /backup | Servers: ${client.guilds.cache.size}`);
    await deploySlash(token);
  });

  await client.login(token);
}

main().catch(e => { console.error(e); process.exit(1); });
