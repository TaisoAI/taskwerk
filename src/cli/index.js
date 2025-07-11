import { Command } from 'commander';
import { createRequire } from 'module';
import { aboutCommand } from '../commands/about.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json');

const program = new Command();

program.name('taskwerk').description(packageJson.description).version(packageJson.version);

program.addCommand(aboutCommand());

program.parse(process.argv);
