#!/usr/bin/env node
import { Command } from "commander";
import { registerAddCommand } from "./commands/add.js";
import { registerListCommand } from "./commands/list.js";
import { registerRemoveCommand } from "./commands/remove.js";
import { registerUseCommand } from "./commands/use.js";
import { registerCurrentCommand } from "./commands/current.js";
import { registerPinCommand } from "./commands/pin.js";
import { registerGuardCommands } from "./commands/guard.js";
import { registerLinkCommands } from "./commands/link.js";
import { registerDoctorCommand } from "./commands/doctor.js";

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
registerPinCommand(program);
registerGuardCommands(program);
registerLinkCommands(program);
registerDoctorCommand(program);

program.parse();