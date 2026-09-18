#!/usr/bin/env node
import { Command } from "commander";
import { registerAddCommand } from "./commands/add.js";
import { registerListCommand } from "./commands/list.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerUseCommand } from "./commands/use.js";
import { registerCurrentCommand } from "./commands/current.js";

const program = new Command();

program
  .name("gitsw")
  .description("Switch safely between multiple GitHub accounts")
  .version("0.1.0");

registerAddCommand(program);
registerListCommand(program);
registerRemoveCommand(program);
registerUseCommand(program);
registerCurrentCommand(program);

program.parse();