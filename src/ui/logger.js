import chalk from 'chalk';
import boxen from 'boxen';
import cliProgress from 'cli-progress';
import { viqoleGradient } from './banner.js';

function timestamp() {
  const now = new Date();
  return chalk.gray(`[${now.toTimeString().split(' ')[0]}]`);
}

export const logger = {
  success: (msg) => {
    console.log(`${timestamp()} ${chalk.greenBright.bold('[+]')} ${chalk.white(msg)}`);
  },
  info: (msg) => {
    console.log(`${timestamp()} ${chalk.cyanBright.bold('[i]')} ${chalk.white(msg)}`);
  },
  warn: (msg) => {
    console.log(`${timestamp()} ${chalk.yellowBright.bold('[!]')} ${chalk.yellow(msg)}`);
  },
  error: (msg) => {
    console.log(`${timestamp()} ${chalk.redBright.bold('[-]')} ${chalk.red(msg)}`);
  },
  step: (stepNum, totalSteps, title) => {
    console.log(`\n${timestamp()} ${chalk.magentaBright.bold(`[Aşama ${stepNum}/${totalSteps}]`)} ${chalk.bold.cyanBright(title)}`);
    console.log(chalk.gray('─'.repeat(55)));
  },
  divider: () => {
    console.log(chalk.gray('─'.repeat(55)));
  },
  stats: (stats) => {
    const totalOps = (stats.rolesCreated || 0) + 
                     (stats.categoriesCreated || 0) + 
                     (stats.channelsCreated || 0) + 
                     (stats.emojisCreated || 0) + 
                     (stats.messagesCloned || 0);
    const failed = stats.failed || 0;
    const successRate = totalOps > 0 ? Math.round((totalOps / (totalOps + failed)) * 100) : 100;

    const statsContent = 
      `${viqoleGradient.multiline('       ★ VIQOLE CLONER İSTATİSTİK RAPORU ★')}\n\n` +
      `${chalk.cyan('👑 Oluşturulan Roller:')}       ${chalk.bold.green(stats.rolesCreated || 0)}\n` +
      `${chalk.cyan('📁 Oluşturulan Kategoriler:')}  ${chalk.bold.green(stats.categoriesCreated || 0)}\n` +
      `${chalk.cyan('💬 Oluşturulan Kanallar:')}     ${chalk.bold.green(stats.channelsCreated || 0)}\n` +
      `${chalk.cyan('😀 Kopyalanan Emojiler:')}      ${chalk.bold.green(stats.emojisCreated || 0)}\n` +
      `${chalk.cyan('📨 Aktarılan Mesajlar:')}       ${chalk.bold.green(stats.messagesCloned || 0)}\n` +
      `${chalk.gray('─'.repeat(42))}\n` +
      `${chalk.yellow('⚠️  Başarısız İşlemler:')}      ${failed > 0 ? chalk.bold.red(failed) : chalk.bold.gray('0')}\n` +
      `${chalk.magenta('📈 Başarı Oranı:')}             ${successRate >= 90 ? chalk.bold.greenBright(`${successRate}%`) : chalk.bold.yellow(`${successRate}%`)}\n` +
      `${chalk.magenta('⏱️  Toplam Geçen Süre:')}       ${chalk.bold.white(stats.elapsedTime || '0s')}\n` +
      `${chalk.gray('─'.repeat(42))}\n` +
      `${chalk.italic.gray('Yapan: viqole | Teşekkürler!')}`;

    console.log('\n' + boxen(statsContent, {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'cyanBright',
      float: 'center'
    }));
  },
  createProgressBar: (title) => {
    return new cliProgress.SingleBar({
      format: `${chalk.cyan(title)} |${chalk.cyanBright('{bar}')}| {percentage}% || {value}/{total} {unit}`,
      barCompleteChar: '█',
      barIncompleteChar: '░',
      hideCursor: true,
      stopOnComplete: true
    }, cliProgress.Presets.shades_classic);
  }
};
