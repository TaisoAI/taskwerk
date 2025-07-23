import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { spawn } from 'child_process';
import * as yaml from 'yaml';

describe('aiconfig command - global/local operations', () => {
  let tempDir;
  let projectDir;
  let originalHome;
  let originalCwd;
  
  beforeEach(() => {
    // Save original values
    originalHome = process.env.HOME;
    originalCwd = process.cwd();
    
    // Create temp directories
    tempDir = mkdtempSync(join(tmpdir(), 'taskwerk-aiconfig-test-'));
    projectDir = join(tempDir, 'project');
    
    // Set up test environment
    process.env.HOME = tempDir;
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(tempDir, '.config', 'taskwerk'), { recursive: true });
    mkdirSync(join(projectDir, '.taskwerk'), { recursive: true });
    
    // Change to project directory
    process.chdir(projectDir);
  });
  
  afterEach(() => {
    // Restore original values
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    
    // Clean up
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
  
  // Helper to run CLI command
  async function runCommand(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [
        join(process.cwd(), '../../src/cli/index.js'),
        'aiconfig',
        ...args
      ], {
        cwd: projectDir,
        env: { ...process.env, HOME: tempDir }
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', data => stdout += data.toString());
      proc.stderr.on('data', data => stderr += data.toString());
      
      proc.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }
  
  describe('--set with --global flag', () => {
    it('should save to global config with --global flag', async () => {
      const globalPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
      const localPath = join(projectDir, '.taskwerk', 'config.yml');
      
      await runCommand(['--set', 'openai.api_key=sk-test-global', '--global']);
      
      // Check global config
      expect(existsSync(globalPath)).toBe(true);
      const globalConfig = yaml.parse(readFileSync(globalPath, 'utf8'));
      expect(globalConfig.ai.providers.openai.api_key).toBe('********');
      
      // Check local config doesn't have it
      if (existsSync(localPath)) {
        const localConfig = yaml.parse(readFileSync(localPath, 'utf8'));
        expect(localConfig.ai?.providers?.openai?.api_key).toBeUndefined();
      }
    });
    
    it('should save to local config without --global flag', async () => {
      const globalPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
      const localPath = join(projectDir, '.taskwerk', 'config.yml');
      
      await runCommand(['--set', 'openai.api_key=sk-test-local']);
      
      // Check local config
      expect(existsSync(localPath)).toBe(true);
      const localConfig = yaml.parse(readFileSync(localPath, 'utf8'));
      expect(localConfig.ai.providers.openai.api_key).toBe('********');
      
      // Check global config doesn't have it
      if (existsSync(globalPath)) {
        const globalConfig = yaml.parse(readFileSync(globalPath, 'utf8'));
        expect(globalConfig.ai?.providers?.openai?.api_key).toBeUndefined();
      }
    });
  });
  
  describe('--show with scope flags', () => {
    beforeEach(async () => {
      // Set up test configs
      const globalConfig = {
        ai: {
          providers: {
            openai: { api_key: 'global-key' },
            anthropic: { api_key: 'global-anthropic' }
          },
          current_provider: 'openai'
        }
      };
      
      const localConfig = {
        ai: {
          providers: {
            openai: { api_key: 'local-key' }
          },
          current_model: 'gpt-4'
        }
      };
      
      writeFileSync(
        join(tempDir, '.config', 'taskwerk', 'config.yml'),
        yaml.stringify(globalConfig)
      );
      
      writeFileSync(
        join(projectDir, '.taskwerk', 'config.yml'),
        yaml.stringify(localConfig)
      );
    });
    
    it('should show only global config with --global', async () => {
      const { stdout } = await runCommand(['--show', '--global']);
      
      expect(stdout).toContain('Global Configuration');
      expect(stdout).toContain('anthropic');
      expect(stdout).not.toContain('current_model'); // Local only
    });
    
    it('should show only local config with --local', async () => {
      const { stdout } = await runCommand(['--show', '--local']);
      
      expect(stdout).toContain('Local Configuration');
      expect(stdout).toContain('current_model');
      expect(stdout).not.toContain('anthropic'); // Global only
    });
    
    it('should show config with sources using --show-origin', async () => {
      const { stdout } = await runCommand(['--show-origin']);
      
      expect(stdout).toContain('Configuration Sources');
      expect(stdout).toContain('🌍'); // Global icon
      expect(stdout).toContain('📁'); // Local icon
      expect(stdout).toContain('(global)');
      expect(stdout).toContain('(local)');
    });
  });
  
  describe('Migration commands', () => {
    beforeEach(async () => {
      // Set up local config
      const localConfig = {
        ai: {
          providers: {
            openai: { api_key: 'local-key-to-migrate' }
          },
          current_provider: 'openai',
          current_model: 'gpt-4'
        }
      };
      
      writeFileSync(
        join(projectDir, '.taskwerk', 'config.yml'),
        yaml.stringify(localConfig)
      );
    });
    
    it('should migrate local to global with --migrate-to-global', async () => {
      const globalPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
      const localPath = join(projectDir, '.taskwerk', 'config.yml');
      
      const { stdout } = await runCommand(['--migrate-to-global']);
      
      expect(stdout).toContain('Successfully migrated');
      
      // Check global has the config
      const globalConfig = yaml.parse(readFileSync(globalPath, 'utf8'));
      expect(globalConfig.ai.current_provider).toBe('openai');
      expect(globalConfig.ai.current_model).toBe('gpt-4');
      
      // Check local is empty
      const localConfig = yaml.parse(readFileSync(localPath, 'utf8'));
      expect(localConfig).toEqual({});
    });
    
    it('should copy global to local with --copy-from-global', async () => {
      // First migrate to global
      await runCommand(['--migrate-to-global']);
      
      // Clear local
      writeFileSync(
        join(projectDir, '.taskwerk', 'config.yml'),
        yaml.stringify({})
      );
      
      // Copy from global
      const { stdout } = await runCommand(['--copy-from-global']);
      
      expect(stdout).toContain('Successfully copied');
      
      // Check local has the config
      const localConfig = yaml.parse(readFileSync(
        join(projectDir, '.taskwerk', 'config.yml'),
        'utf8'
      ));
      expect(localConfig.ai.current_provider).toBe('openai');
      expect(localConfig.ai.current_model).toBe('gpt-4');
    });
  });
  
  describe('--clear command', () => {
    beforeEach(async () => {
      // Set up configs
      await runCommand(['--set', 'openai.api_key=global-clear', '--global']);
      await runCommand(['--set', 'anthropic.api_key=local-clear']);
    });
    
    it('should clear local config with --clear', async () => {
      const localPath = join(projectDir, '.taskwerk', 'config.yml');
      
      await runCommand(['--clear']);
      
      const localConfig = yaml.parse(readFileSync(localPath, 'utf8'));
      expect(localConfig).toEqual({});
    });
    
    it('should clear global config with --clear --global', async () => {
      const globalPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
      
      await runCommand(['--clear', '--global']);
      
      const globalConfig = yaml.parse(readFileSync(globalPath, 'utf8'));
      expect(globalConfig).toEqual({});
    });
  });
  
  describe('--choose and --provider/--model with scope', () => {
    it('should save provider/model to global with --global', async () => {
      // Mock provider config first
      await runCommand(['--set', 'openai.api_key=test-key', '--global']);
      
      // This would normally require interactive input, so we'll test the direct method
      const { stdout } = await runCommand(['--provider', 'openai', '--model', 'gpt-4', '--global']);
      
      expect(stdout).toContain('global config');
      
      const globalPath = join(tempDir, '.config', 'taskwerk', 'config.yml');
      const globalConfig = yaml.parse(readFileSync(globalPath, 'utf8'));
      
      expect(globalConfig.ai.current_provider).toBe('openai');
      expect(globalConfig.ai.current_model).toBe('gpt-4');
    });
  });
  
  describe('Priority and merging', () => {
    it('should show merged config respecting priority', async () => {
      // Set different values in global and local
      await runCommand(['--set', 'openai.api_key=global-key', '--global']);
      await runCommand(['--set', 'anthropic.api_key=global-anthropic', '--global']);
      await runCommand(['--set', 'openai.api_key=local-key']); // Override
      
      const { stdout } = await runCommand(['--show']);
      
      // Should show merged view
      expect(stdout).toContain('openai: ✅');
      expect(stdout).toContain('anthropic: ✅');
      
      // With origin, should show sources
      const { stdout: originOutput } = await runCommand(['--show-origin']);
      
      expect(originOutput).toContain('openai');
      expect(originOutput).toContain('📁'); // Local source for overridden openai
      expect(originOutput).toContain('anthropic');
      expect(originOutput).toContain('🌍'); // Global source for anthropic
    });
  });
});

describe('aiconfig integration tests', () => {
  // These would be more complex integration tests
  // that actually test with real provider interactions
  
  it.skip('should test connection with globally configured provider', async () => {
    // Would need actual API keys in env vars
  });
  
  it.skip('should discover models from global config', async () => {
    // Would need actual API keys in env vars
  });
});