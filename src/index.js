
import 'dotenv/config';
import http from 'http';
import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import chalk from 'chalk';
import { showBanner } from './ui/banner.js';
import { logger } from './ui/logger.js';
import { startDirectClone } from './core/cloner.js';
import { createBackup } from './core/backup.js';

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is Online - Premium Cloner');
}).listen(process.env.PORT || 3000);

function sanitizeToken(t) { return t ? t.trim().replace(/^["'`]+|["'`]+$/g, '').trim() : ''; }
const PREFIX = '!';
const CLIENT_ID = process.env.CLIENT_ID;

// ===== SERVER LOCK + YOUR INVITE LINK =====
const ALLOWED_GUILDS = process.env.OWNER_GUILD_ID ? process.env.OWNER_GUILD_ID.split(',').map(s=>s.trim()).filter(Boolean) : [];
const SUPPORT_INVITE = process.env.SUPPORT_SERVER_INVITE || 'https://discord.gg/vva6pd3yPA';

function isAllowedGuild(guildId) {
  if (ALLOWED_GUILDS.length === 0) return true;
  return ALLOWED_GUILDS.includes(guildId);
}

function getNotAllowedEmbed(client) {
  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('❌ Access Denied')
    .setDescription(`**You are not in this server!**\n\nThis bot is private and only works in the owner's server.\n\n💎 **You are not in this server**`)
    .addFields(
      { name: '🔗 Join Our Server', value: `[Click to Join](${SUPPORT_INVITE})\n\`${SUPPORT_INVITE}\``, inline: false },
      { name: '📝 How to get access?', value: `Join our support server to request access.\nOnly allowed servers can use clone.`, inline: false }
    )
    .setThumbnail(client.user.displayAvatarURL())
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Join Support Server').setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE),
    new ButtonBuilder().setLabel('Invite Me').setStyle(ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`)
  );

  return { embeds: [embed], components: [row] };
}
// ===========================================

const slashCommands = [
  new SlashCommandBuilder().setName('help').setDescription('Show premium help menu'),
  new SlashCommandBuilder().setName('ping').setDescription('Check bot status'),
  new SlashCommandBuilder().setName('clone').setDescription('Clone server - premium UI')
    .addStringOption(o => o.setName('source_id').setDescription('Source Server ID').setRequired(true))
    .addStringOption(o => o.setName('target_id').setDescription('Target Server ID').setRequired(true)),
].map(c => c.toJSON());

async function deploySlash(token) {
  if (!CLIENT_ID) { logger.warn('CLIENT_ID missing'); return; }
  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
    logger.success('Slash deployed!');
  } catch (e) { logger.error(e.message); }
}

function getHelpEmbed(client) {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setAuthor({ name: 'Server Cloner', iconURL: client.user.displayAvatarURL() })
    .setTitle('🔨 Server Cloner')
    .setDescription(`Prefix: \`${PREFIX}\` · ${client.guilds.cache.size} server(s)`)
    .setThumbnail(client.user.displayAvatarURL({ size: 1024 }))
    .addFields(
      { 
        name: '🔗 Token', 
        value: `💎 \`${PREFIX}link\` — Link your Discord user token\n💎 \`${PREFIX}unlink\` — Remove your saved token\n💎 \`${PREFIX}tokencheck\` — Check if token is valid`,
        inline: false 
      },
      { 
        name: '🔨 Clone', 
        value: `💎 \`${PREFIX}clone <source> <target>\`\n💎 Clone an entire server\n💎 Channels, Roles & Emojis`,
        inline: false 
      },
      { 
        name: '⚙️ Utility', 
        value: `💎 \`${PREFIX}ping\` — Check bot latency\n💎 \`${PREFIX}help\` — This help menu`,
        inline: false 
      },
      { name: '\u200b', value: `🖥️ Serving ${client.guilds.cache.size} server(s)`, inline: false }
    )
    .setTimestamp();

  // UPDATED BUTTONS WITH YOUR LINK
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Invite Me').setStyle(ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot`),
    new ButtonBuilder().setLabel('~Coder').setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE),
    new ButtonBuilder().setLabel('~Updates').setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Join Server').setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE)
  );

  return { embeds: [embed], components: [row, row2] };
}

function getSetupEmbed(sourceName, targetName) {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('🔨 Server Cloner — Setup')
    .addFields(
      { name: '\u200b', value: `💎 **Source:** \`${sourceName}\`\n💎 **Target:** \`${targetName}\`\n\n**__Select Options to Clone:__**\n\n\` 1. \` Delete Existing Channels\n\` 2. \` Delete Existing Roles\n\` 3. \` Delete Existing Emojis\n\` 4. \` Clone Channels & Categories\n\` 5. \` Clone Roles & Permissions\n\` 6. \` Clone Emojis\n\n💎 Toggle options below then click **Start Cloning**`, inline: false },
      { name: '\u200b', value: `⚙️ Requested by ${sourceName}`, inline: false }
    );
}

function getProgressEmbed(sourceName, targetName, delStats, cloneStats, isCompleted = false) {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`🔨 Server Cloner — ${isCompleted ? 'Finished' : 'Progress'}`)
    .addFields(
      { name: '\u200b', value: `💎 **Source:** \`${sourceName}\`\n💎 **Target:** \`${targetName}\`\n💎 **Status:** ${isCompleted ? '✅ Completed!' : '⏳ In Progress...'}\n\n**__Deletion Progress__**\n💎 Channels: \`${delStats.channels.done}/${delStats.channels.total}\`\n💎 Roles: \`${delStats.roles.done}/${delStats.roles.total}\`\n💎 Emojis: \`${delStats.emojis.done}/${delStats.emojis.total}\`\n\n**__Cloning Progress__**\n💎 Roles: \`${cloneStats.roles.done}/${cloneStats.roles.total}\`\n💎 Categories: \`${cloneStats.categories.done}/${cloneStats.categories.total}\`\n💎 Text Channels: \`${cloneStats.text.done}/${cloneStats.text.total}\`\n💎 Voice Channels: \`${cloneStats.voice.done}/${cloneStats.voice.total}\``, inline: false },
      { name: '\u200b', value: `⚙️ ${isCompleted ? 'Cloned' : 'Cloning'} by ${targetName}`, inline: false }
    );
}

function getFinishedEmbed(sourceName, targetName, summary) {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('✅ Server Cloner — Finished')
    .addFields(
      { name: '\u200b', value: `💎 **Source:** \`${sourceName}\`\n💎 **Target:** \`${targetName}\`\n\n**__Summary__**\n✅ Deleted **${summary.deletedChannels}** channels\n✅ Deleted **${summary.deletedRoles}** roles\n✅ Deleted **${summary.deletedEmojis}** emojis\n✅ Cloned **${summary.roles}** roles\n✅ Cloned **${summary.categories}** categories\n✅ Cloned **${summary.text}** text channels\n✅ Cloned **${summary.voice}** voice channels`, inline: false },
      { name: '\u200b', value: `⚙️ Cloned by ${targetName}`, inline: false }
    );
}

async function main() {
  showBanner();
  const token = sanitizeToken(process.env.DISCORD_TOKEN);
  if (!token) { logger.error('DISCORD_TOKEN missing!'); process.exit(1); }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.MessageContent],
    partials: [Partials.GuildMember, Partials.Channel]
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // SERVER LOCK CHECK
    if (message.guild && !isAllowedGuild(message.guild.id)) {
      if (['clone', 'backup'].includes(cmd)) {
        return message.reply(getNotAllowedEmbed(client)).catch(()=>{});
      }
    }

    try {
      if (cmd === 'help') {
        const helpData = getHelpEmbed(client);
        return message.reply(helpData).catch(()=>{});
      }
      if (cmd === 'ping') {
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x2B2D31).setDescription(`💎 Pong! ${client.ws.ping}ms`)] }).catch(()=>{});
      }
      if (cmd === 'clone') {
        const [sId, tId] = args;
        if (!sId || !tId) return message.reply('Usage: `!clone <sourceId> <targetId>`').catch(()=>{});
        const sG = await client.guilds.fetch(sId).catch(()=>null);
        const tG = await client.guilds.fetch(tId).catch(()=>null);
        if (!sG || !tG) return message.reply('Bot not in both servers!').catch(()=>{});

        const setupEmbed = getSetupEmbed(sG.name, tG.name);
        await message.reply({ embeds: [setupEmbed] }).catch(()=>{});
        
        await new Promise(r => setTimeout(r, 1000));
        await message.channel.send({ embeds: [new EmbedBuilder().setColor(0x2B2D31).setDescription('🔄 Starting cloning process in 3 seconds...')] }).catch(()=>{});
        await new Promise(r => setTimeout(r, 3000));

        let delStats = { channels: { done: 0, total: 4 }, roles: { done: 0, total: 0 }, emojis: { done: 0, total: 0 } };
        let cloneStats = { roles: { done: 0, total: sG.roles.cache.size-1 }, categories: { done: 0, total: sG.channels.cache.filter(c=>c.type===4).size }, text: { done: 0, total: sG.channels.cache.filter(c=>c.type===0).size }, voice: { done: 0, total: sG.channels.cache.filter(c=>c.type===2).size } };
        
        const progressMsg = await message.channel.send({ embeds: [getProgressEmbed(sG.name, tG.name, delStats, cloneStats, false)] }).catch(()=>null);

        try {
          const finalStats = await startDirectClone(client, sId, tId, { cloneRoles: true, cloneChannels: true, cloneEmojis: true, protectedChannelId: message.channel.id },
            (progress) => {
              if (progress.stage === 'DELETE') delStats = progress.delStats;
              if (progress.stage === 'ROLES') cloneStats.roles.done = progress.done;
              if (progress.stage === 'CATEGORIES') cloneStats.categories.done = progress.done;
              if (progress.stage === 'TEXT') cloneStats.text.done = progress.done;
              if (progress.stage === 'VOICE') cloneStats.voice.done = progress.done;
              if (progressMsg) progressMsg.edit({ embeds: [getProgressEmbed(sG.name, tG.name, delStats, cloneStats, false)] }).catch(()=>{});
            }
          );

          const summary = {
            deletedChannels: finalStats.deleted?.channels || 4,
            deletedRoles: finalStats.deleted?.roles || 0,
            deletedEmojis: finalStats.deleted?.emojis || 0,
            roles: finalStats.roles?.cloned || cloneStats.roles.total,
            categories: finalStats.categories?.cloned || cloneStats.categories.total,
            text: finalStats.text?.cloned || cloneStats.text.total,
            voice: finalStats.voice?.cloned || cloneStats.voice.total
          };

          await message.channel.send({ embeds: [getFinishedEmbed(sG.name, tG.name, summary)] }).catch(()=>{});
          if (progressMsg) await progressMsg.edit({ embeds: [getProgressEmbed(sG.name, tG.name, delStats, cloneStats, true)] }).catch(()=>{});
        } catch (e) {
          await message.channel.send(`Failed: ${e.message}`).catch(()=>{});
        }
      }
    } catch (e) { logger.error(e.message); }
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.guildId && !isAllowedGuild(interaction.guildId)) {
      if (['clone', 'backup'].includes(interaction.commandName)) {
        return interaction.reply(getNotAllowedEmbed(client)).catch(()=>{});
      }
    }

    await interaction.deferReply().catch(()=>{});
    const cmd = interaction.commandName;
    if (cmd === 'help') {
      const helpData = getHelpEmbed(client);
      return interaction.editReply(helpData);
    }
    if (cmd === 'clone') {
      const sId = interaction.options.getString('source_id');
      const tId = interaction.options.getString('target_id');
      const sG = await client.guilds.fetch(sId).catch(()=>null);
      const tG = await client.guilds.fetch(tId).catch(()=>null);
      if (!sG || !tG) return interaction.editReply('Bot not in both servers!');
      await interaction.editReply({ embeds: [getSetupEmbed(sG.name, tG.name)] });
    }
  });

  client.once('ready', async () => {
    logger.success(`Online as ${chalk.bold.cyan(client.user.tag)} | Locked Invite: ${SUPPORT_INVITE}`);
    await deploySlash(token);
  });

  await client.login(token);
}

main().catch(e => { console.error(e); process.exit(1); });
