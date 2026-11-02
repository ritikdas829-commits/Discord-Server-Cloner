import 'dotenv/config';
import http from 'http';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import chalk from 'chalk';
import { showBanner } from './ui/banner.js';
import { logger } from './ui/logger.js';
import { startDirectClone } from './core/cloner.js';
import { createBackup } from './core/backup.js';

// Render ke liye port fix - isse offline/crash nahi hoga
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is Online - Server cloner#8260');
}).listen(process.env.PORT || 3000);

function sanitizeToken(rawToken) {
  if (!rawToken) return '';
  return rawToken.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
}

const PREFIX = '!';
const CLIENT_ID = process.env.CLIENT_ID;

const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('Show help menu with UI'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot ping & status'),
  new SlashCommandBuilder().setName('backup').setDescription('Create backup').addStringOption(o => o.setName('guild_id').setDescription('Guild ID').setRequired(false)),
  new SlashCommandBuilder().setName('clone').setDescription('Clone server A to B')
    .addStringOption(o => o.setName('source_id').setDescription('Source Server ID').setRequired(true))
    .addStringOption(o => o.setName('target_id').setDescription('Target Server ID').setRequired(true)),
].map(c => c.toJSON());

async function deploySlash(token) {
  if (!CLIENT_ID) {
    logger.warn('CLIENT_ID missing - slash skip ( ! commands work )');
    return;
  }
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    logger.info('Deploying slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
    logger.success('✅ Slash commands deployed!');
  } catch (e) {
    logger.error(`Slash deploy fail: ${e.message}`);
  }
}

// Beautiful Help Embed
function getHelpEmbed(client) {
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('⚡ Viqole - Server Cloner [v1.0.0]')
    .setDescription('Next-Gen Ultra Fast & Reliable Cloner')
    .setThumbnail(client.user.displayAvatarURL())
    .addFields(
      { name: '📋 Prefix Commands', value: `\`!help\` - Ye menu\n\`!ping\` - Bot status\n\`!clone <src> <tgt>\` - Clone server\n\`!backup [id]\` - Backup create`, inline: true },
      { name: '🔷 Slash Commands', value: `\`/help\` - Ye menu\n\`/ping\` - Bot status\n\`/clone source_id:xxx target_id:yyy\` - Clone\n\`/backup\` - Backup`, inline: true },
      { name: '📖 How to use?', value: '1. Bot ko dono server me **Administrator** ke saath add karo\n2. Developer Mode ON -> Server ID copy karo\n3. `!clone SOURCE_ID TARGET_ID` likh do', inline: false },
      { name: '⚠️ Caution', value: 'Target server me pehle se channels hai to wo delete ho sakte hai agar clear ON hai!', inline: false }
    )
    .setFooter({ text: `Bot: ${client.user.tag} | Servers: ${client.guilds.cache.size} | Prefix: ${PREFIX}` })
    .setTimestamp();
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

  // PREFIX
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    const context = {
      reply: (data) => message.reply(data).catch(()=>{}),
      followUp: (data) => message.channel.send(data).catch(()=> message.author.send(data).catch(()=>{})),
      guildId: message.guild?.id,
      protectedChannelId: message.channel.id,
      isSlash: false
    };

    try {
      if (cmd === 'help') {
        return context.reply({ embeds: [getHelpEmbed(client)] });
      }
      if (cmd === 'ping') {
        return context.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`🏓 Pong! **${client.ws.ping}ms**\n✅ Online in **${client.guilds.cache.size}** servers`)] });
      }
      if (cmd === 'clone') {
        const [sId, tId] = args;
        if (!sId || !tId) return context.reply('❌ Use: `!clone <sourceId> <targetId>`');
        const sG = await client.guilds.fetch(sId).catch(()=>null);
        const tG = await client.guilds.fetch(tId).catch(()=>null);
        if (!sG || !tG) return context.reply('❌ Bot dono server me nahi hai! Admin ke saath invite karo.');
        await context.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription(`🚀 **Cloning Started**\n**From:** ${sG.name}\n**To:** ${tG.name}\n2-5 min lagega...`)] });
        try {
          await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true, protectedChannelId: context.protectedChannelId });
          await context.followUp({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ **Clone Complete!**\n${sG.name} -> ${tG.name}`)] });
        } catch (e) { await context.followUp(`❌ Fail: ${e.message}`); }
      }
      if (cmd === 'backup') {
        const gId = args[0] || message.guild?.id;
        const g = await client.guilds.fetch(gId).catch(()=>null);
        if (!g) return context.reply('❌ Guild nahi mila');
        await context.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(`📦 **Backup:** ${g.name}...`)] });
        try { await createBackup(g, { backupEmojis: true }); await context.followUp('✅ Backup Done!'); }
        catch (e) { await context.followUp(`❌ ${e.message}`); }
      }
    } catch (e) { logger.error(e.message); }
  });

  // SLASH
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction.commandName;

    const context = {
      reply: (data) => interaction.reply(data).catch(()=>{}),
      followUp: (data) => interaction.followUp(data).catch(()=>{}),
      guildId: interaction.guildId,
      protectedChannelId: null,
      isSlash: true
    };

    await interaction.deferReply().catch(()=>{});

    try {
      if (cmd === 'help') {
        return context.reply({ embeds: [getHelpEmbed(client)] });
      }
      if (cmd === 'ping') {
        return context.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`🏓 Pong! **${client.ws.ping}ms**\nServers: ${client.guilds.cache.size}`)] });
      }
      if (cmd === 'backup') {
        const gId = interaction.options.getString('guild_id') || interaction.guildId;
        const g = await client.guilds.fetch(gId).catch(()=>null);
        if (!g) return context.reply('❌ Guild nahi mila');
        await context.reply({ embeds: [new EmbedBuilder().setColor('Blue').setDescription(`📦 Backup: ${g.name}...`)] });
        try { await createBackup(g, { backupEmojis: true }); await context.followUp('✅ Backup Done!'); }
        catch (e) { await context.followUp(`❌ ${e.message}`); }
      }
      if (cmd === 'clone') {
        const sId = interaction.options.getString('source_id');
        const tId = interaction.options.getString('target_id');
        if (sId === tId) return context.reply('❌ Same ID!');
        const sG = await client.guilds.fetch(sId).catch(()=>null);
        const tG = await client.guilds.fetch(tId).catch(()=>null);
        if (!sG || !tG) return context.reply('❌ Bot dono server me nahi hai!');
        await context.reply({ embeds: [new EmbedBuilder().setColor('Orange').setDescription(`🚀 Cloning **${sG.name}** -> **${tG.name}**...`)] });
        try {
          await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true });
          await context.followUp({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Complete: ${sG.name} -> ${tG.name}`)] });
        } catch (e) { await context.followUp(`❌ ${e.message}`); }
      }
    } catch (e) { logger.error(e.message); }
  });

  client.once('ready', async () => {
    logger.success(`Online as ${chalk.bold.cyan(client.user.tag)}`);
    logger.info(`Prefix: ${PREFIX} | Slash: /help /ping /clone /backup`);
    await deploySlash(token);
  });

  // Deprecation fix - ready -> clientReady
  client.on('ready', () => {}); // dummy for old event

  await client.login(token);
}

main().catch(e => { console.error(e); process.exit(1); });
