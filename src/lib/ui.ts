import chalk from "chalk";
import logSymbols from "log-symbols";
import Table from "cli-table3";
import boxen from "boxen";
import ora, { type Ora } from "ora";

export function ok(message: string): void {
  console.log(`${logSymbols.success} ${message}`);
}

export function warn(message: string): void {
  console.log(`${logSymbols.warning} ${chalk.yellow(message)}`);
}

export function fail(message: string): void {
  console.log(`${logSymbols.error} ${chalk.red(message)}`);
}

export function info(message: string): void {
  console.log(`${logSymbols.info} ${message}`);
}

export function dim(message: string): void {
  console.log(chalk.dim(message));
}

export function heading(text: string): void {
  console.log(chalk.bold.underline(text));
}

export function hint(command: string): void {
  console.log(chalk.dim(`  → ${command}`));
}

export function makeTable(head: string[]) {
  return new Table({
    head: head.map((h) => chalk.bold(h)),
    style: { head: [], border: ["dim"] },
  });
}

export function box(content: string, title?: string): void {
  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderColor: "cyan",
      borderStyle: "round",
      title,
      titleAlignment: "left",
    })
  );
}

export function spinner(text: string): Ora {
  return ora({ text, color: "cyan" }).start();
}
