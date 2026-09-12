import { select, input, confirm, number, search, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { t } from '../i18n/index.js';

/**
 * Main Interactive Menu
 */
export async function promptMainMenu() {
  return await select({
    message: t('menuTitle'),
    choices: [
      {
        name: t('menuDirectClone'),
        value: 'DIRECT_CLONE',
        description: t('menuDirectCloneDesc')
      },
      {
        name: t('menuCreateBackup'),
        value: 'CREATE_BACKUP',
        description: t('menuCreateBackupDesc')
      },
      {
        name: t('menuRestoreBackup'),
        value: 'RESTORE_BACKUP',
        description: t('menuRestoreBackupDesc')
      },
      {
        name: t('menuChangeLang'),
        value: 'CHANGE_LANG',
        description: t('menuChangeLangDesc')
      },
      {
        name: t('menuExit'),
        value: 'EXIT',
        description: t('menuExitDesc')
      }
    ]
  });
}

/**
 * Check if the current user has Administrator or Manage Server permissions in a guild
 */
function hasAdminPermissions(guild, client) {
  if (guild.ownerId === client.user.id) return true;
  const me = guild.members.me || guild.members.cache.get(client.user.id);
  if (!me) return false;
  return me.permissions?.has('ADMINISTRATOR') || me.permissions?.has('MANAGE_GUILD');
}

/**
 * Select or input a guild from client.guilds with real-time text search and admin sorting.
 * @param {Client} client - Discord client
 * @param {string} promptMessage - Prompt title
 * @param {boolean} isTarget - If true, sorts Administrator guilds to the top
 */
export async function promptSelectGuild(client, promptMessage = t('selectGuildTitle'), isTarget = false) {
  const allGuilds = Array.from(client.guilds.cache.values());

  let sortedGuilds = [];
  let adminGuilds = [];
  let otherGuilds = [];

  if (isTarget) {
    adminGuilds = allGuilds.filter((g) => hasAdminPermissions(g, client));
    otherGuilds = allGuilds.filter((g) => !hasAdminPermissions(g, client));
    sortedGuilds = [...adminGuilds, ...otherGuilds];
  } else {
    sortedGuilds = allGuilds.sort((a, b) => b.memberCount - a.memberCount);
  }

  // Build choices array
  const rawChoices = [];

  for (const g of sortedGuilds) {
    const isAdmin = hasAdminPermissions(g, client);
    let displayName = '';

    if (isTarget) {
      if (isAdmin) {
        displayName = `${chalk.green.bold(t('adminBadge'))} ${chalk.white.bold(g.name)} ${chalk.gray(`(${g.id})`)} ${chalk.cyan(`[${t('memberCount')}: ${g.memberCount}]`)}`;
      } else {
        displayName = `${chalk.gray('⚪')} ${chalk.gray(g.name)} ${chalk.gray(`(${g.id})`)} ${chalk.yellow(t('notAdminBadge'))}`;
      }
    } else {
      const badge = isAdmin ? chalk.green('👑') : chalk.white('🌐');
      displayName = `${badge} ${chalk.white(g.name)} ${chalk.gray(`(${g.id})`)} ${chalk.cyan(`[${t('memberCount')}: ${g.memberCount}]`)}`;
    }

    rawChoices.push({
      name: displayName,
      value: g.id,
      plainName: g.name,
      isAdmin
    });
  }

  // Add Manual ID option
  const manualOption = {
    name: `${chalk.cyan.bold('📝')} ${chalk.bold.yellow(t('manualInputOption'))}`,
    value: 'MANUAL',
    plainName: 'Manual ID'
  };
  rawChoices.push(manualOption);

  // Search source callback for real-time typing / filtering
  const searchSource = (term) => {
    const filter = term?.toLowerCase().trim();

    // If user is searching/typing, filter by server name or server ID
    if (filter) {
      return rawChoices.filter((c) => {
        return (
          (c.plainName && c.plainName.toLowerCase().includes(filter)) ||
          (c.value && c.value.toLowerCase().includes(filter))
        );
      });
    }

    // If no search term is entered, show structured list with clear section headers
    if (isTarget) {
      const result = [];
      if (adminGuilds.length > 0) {
        result.push(new Separator(chalk.green.bold(t('headerAdminGuilds'))));
        result.push(...rawChoices.filter((c) => c.isAdmin));
      }
      if (otherGuilds.length > 0) {
        result.push(new Separator(chalk.yellow(t('headerOtherGuilds'))));
        result.push(...rawChoices.filter((c) => c.isAdmin === false));
      }
      result.push(new Separator(chalk.gray('─────────────────────────────────────────────')));
      result.push(manualOption);
      return result;
    }

    return rawChoices;
  };

  const selected = await search({
    message: `${promptMessage} ${chalk.gray(t('searchInstruction'))}`,
    source: searchSource,
    pageSize: 12
  });

  if (selected === 'MANUAL') {
    return await input({
      message: t('manualInputPrompt'),
      validate: (val) => (/^\d{17,20}$/.test(val.trim()) ? true : t('invalidId'))
    });
  }

  return selected;
}

/**
 * Prompt cloning options (checkbox / questions)
 */
export async function promptCloneOptions() {
  const clearTarget = await confirm({
    message: t('optClearTarget'),
    default: true
  });

  const cloneEmojis = await confirm({
    message: t('optCloneEmojis'),
    default: true
  });

  const cloneMedia = await confirm({
    message: t('optCloneMedia'),
    default: true
  });

  const cloneMessages = await confirm({
    message: t('optCloneMessages'),
    default: false
  });

  let maxMessagesPerChannel = 10;
  if (cloneMessages) {
    maxMessagesPerChannel = await number({
      message: t('optMaxMessages'),
      default: 10,
      min: 1,
      max: 50
    });
  }

  return {
    clearTarget,
    cloneEmojis,
    cloneIcon: cloneMedia,
    cloneBanner: cloneMedia,
    cloneMessages,
    maxMessagesPerChannel
  };
}

/**
 * Select a backup file from ./backups directory
 */
export async function promptSelectBackupFile() {
  const backupsDir = path.resolve(process.cwd(), 'backups');
  try {
    const files = await fs.readdir(backupsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return null;
    }

    const choices = jsonFiles.map((file) => ({
      name: file,
      value: path.join(backupsDir, file)
    }));

    return await select({
      message: t('selectBackupFile'),
      choices
    });
  } catch {
    return null;
  }
}
