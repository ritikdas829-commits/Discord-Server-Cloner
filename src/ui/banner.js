import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen from 'boxen';
import { t } from '../i18n/index.js';

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
    `${chalk.bold.white(t('bannerTitle'))}  ${chalk.cyan('[v1.0.0]')}\n` +
    `${chalk.gray('━'.repeat(52))}\n` +
    `${chalk.magenta(t('bannerDeveloper'))} ${chalk.bold.yellow('viqole')}\n` +
    `${chalk.magenta(t('bannerEngine'))}    ${chalk.greenBright(t('bannerEngineDesc'))}\n` +
    `${chalk.magenta(t('bannerModes'))}     ${chalk.cyan(t('bannerModesDesc'))}\n` +
    `${chalk.gray('━'.repeat(52))}\n` +
    `${chalk.yellowBright(t('bannerWarning'))}  ${chalk.bold.white(t('bannerWarningDesc'))}`,
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
