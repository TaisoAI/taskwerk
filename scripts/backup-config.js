#!/usr/bin/env node
import { existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const CONFIG_PATH = join('.taskwerk', 'config.yml');
const BACKUP_PATH = join('.taskwerk', 'config.yml.backup');

if (existsSync(CONFIG_PATH)) {
  copyFileSync(CONFIG_PATH, BACKUP_PATH);
  console.log(`✅ Backed up config to: ${BACKUP_PATH}`);
} else {
  console.log('❌ No config file found to backup');
}