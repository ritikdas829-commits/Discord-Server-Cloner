import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';

// Custom Viqole Neon Gradient (Cyan -> Violet -> Purple -> Magenta)
export const viqoleGradient = gradient([
  '#00f2fe',
  '#4facfe',
  '#7f00ff',
  '#e100ff'
]);

export const goldGradient = gradient([
  '#f6d365',
  '#fda085'
]);

export function showBanner() {
  console.clear();
  
  const ascii = `
   ██╗   ██╗██╗ ██████╗  ██████╗ ██╗     ███████╗
   ██║   ██║██║██╔═══██╗██╔═══██╗██║     ██╔════╝
   ██║   ██║██║██║   ██║██║   ██║██║     █████╗  
   ╚██╗ ██╔╝██║██║▄▄ ██║██║   ██║██║     ██╔══╝  
    ╚████╔╝ ██║╚██████╔╝╚██████╔╝███████╗███████╗
     ╚═══╝  ╚═╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝
        ██████╗██╗      ██████╗ ███╗   ██╗███████╗██████╗ 
       ██╔════╝██║     ██╔═══██╗████╗  ██║██╔════╝██╔══██╗
       ██║     ██║     ██║   ██║██╔██╗ ██║█████╗  ██████╔╝
       ██║     ██║     ██║   ██║██║╚██╗██║██╔══╝  ██╔══██╗
       ╚██████╗███████╗╚██████╔╝██║ ╚████║███████╗██║  ██║
        ╚═════╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝`;

  console.log(viqoleGradient(ascii));

  const infoBox = boxen(
    `${chalk.bold.white('⚡ NEXT-GEN DISCORD SERVER CLONER')}  ${chalk.cyan('[v1.0.0]')}\n` +
    `${chalk.gray('━'.repeat(48))}\n` +
    `${chalk.magenta('👑 Developer:')} ${chalk.bold.yellow('viqole')}\n` +
    `${chalk.magenta('🛡️  Engine:')}    ${chalk.greenBright('Adaptive Rate-Limit & ID Perm Mapper')}\n` +
    `${chalk.magenta('🌐 Modes:')}     ${chalk.cyan('Live Server-to-Server / JSON Template Backup & Restore')}\n` +
    `${chalk.gray('━'.repeat(48))}\n` +
    `${chalk.yellowBright('⚠️  Dikkat:')}  Hedef sunucuda ${chalk.bold.white('Yönetici (Administrator)')} yetkiniz olmalıdır!`,
    {
      padding: 1,
      margin: { top: 0, bottom: 1 },
      borderStyle: 'round',
      borderColor: 'magenta',
      float: 'center'
    }
  );

  console.log(infoBox);
}
