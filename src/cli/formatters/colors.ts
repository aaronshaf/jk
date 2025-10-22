/**
 * ANSI color codes for terminal output
 */

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",

  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

/**
 * Check if stdout is a TTY (supports colors)
 */
export const supportsColor = (): boolean => {
  return process.stdout.isTTY ?? false;
};

/**
 * Apply color only if TTY supports it
 */
const applyColor = (text: string, color: string): string => {
  if (!supportsColor()) return text;
  return `${color}${text}${colors.reset}`;
};

export const red = (text: string) => applyColor(text, colors.red);
export const green = (text: string) => applyColor(text, colors.green);
export const yellow = (text: string) => applyColor(text, colors.yellow);
export const blue = (text: string) => applyColor(text, colors.blue);
export const magenta = (text: string) => applyColor(text, colors.magenta);
export const cyan = (text: string) => applyColor(text, colors.cyan);
export const gray = (text: string) => applyColor(text, colors.gray);
export const bold = (text: string) => applyColor(text, colors.bold);
export const dim = (text: string) => applyColor(text, colors.dim);
