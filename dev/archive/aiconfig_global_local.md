# Global/Local AI Configuration Design

## Overview

Implement a git-style configuration hierarchy for AI/LLM settings in taskwerk, allowing users to set global API keys and preferences while maintaining the ability to override them at the project level.

## Motivation

Currently, taskwerk stores AI configuration only at the project level (.taskwerk/config.json). This requires users to configure API keys for each project separately, which is inconvenient for:
- Personal use across multiple projects
- Quick AI assistance in directories without initialized taskwerk projects
- Developers who want to use the same API keys across all their work

## Design Goals

1. **Convenience**: Set API keys once and use AI features anywhere
2. **Flexibility**: Allow project-specific overrides for teams or special requirements
3. **Backward Compatibility**: Existing project configurations continue to work unchanged
4. **Security**: Provide secure storage options with appropriate warnings
5. **Familiar UX**: Follow git's configuration pattern that developers already understand

## Configuration Hierarchy

Configuration sources in order of precedence (highest to lowest):

1. **Environment Variables** 
   - `TASKWERK_OPENAI_API_KEY`, etc.
   - Always takes precedence for security

2. **Local Project Config**
   - `.taskwerk/config.json`
   - Project-specific settings

3. **Global User Config**
   - `~/.config/taskwerk/config.json` (XDG standard)
   - Falls back to `~/.taskwerk/config.json` if XDG path doesn't exist
   - User-wide defaults

4. **System Defaults**
   - Built-in defaults (e.g., model names, temperature settings)

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Update ConfigManager** (`src/config/config-manager.js`)
   - Add support for multiple config file locations
   - Implement config merging logic (field-level merging)
   - Add methods to distinguish between local/global operations
   - Handle XDG_CONFIG_HOME environment variable

2. **Global Config File Location**
   ```javascript
   function getGlobalConfigPath() {
     // Check XDG_CONFIG_HOME first
     const xdgConfig = process.env.XDG_CONFIG_HOME;
     if (xdgConfig) {
       return path.join(xdgConfig, 'taskwerk', 'config.json');
     }
     
     // Fall back to ~/.config/taskwerk/config.json
     const homeConfig = path.join(os.homedir(), '.config', 'taskwerk', 'config.json');
     
     // Legacy support: check ~/.taskwerk/config.json
     const legacyConfig = path.join(os.homedir(), '.taskwerk', 'config.json');
     
     return fs.existsSync(legacyConfig) ? legacyConfig : homeConfig;
   }
   ```

### Phase 2: CLI Commands

1. **Update `aiconfig` command** (`src/commands/aiconfig.js`)
   - Add `--global` flag for set operations
   - Add `--local` flag to explicitly set local (default behavior)
   - Update `--show` to display merged configuration by default
   - Add `--show-origin` flag to show where each value comes from

2. **New Command Options**
   ```bash
   # Set globally
   twrk aiconfig set openai.api_key=sk-... --global
   
   # Show merged config (default)
   twrk aiconfig --show
   
   # Show only global or local
   twrk aiconfig --show --global
   twrk aiconfig --show --local
   
   # Show config with source information
   twrk aiconfig --show --show-origin
   ```

### Phase 3: Config Merging Logic

1. **Field-Level Merging**
   ```javascript
   // Example: Global has API key, local has model preference
   // Global config:
   {
     "ai": {
       "providers": {
         "openai": {
           "api_key": "sk-global-key",
           "model": "gpt-4"
         }
       }
     }
   }
   
   // Local config:
   {
     "ai": {
       "providers": {
         "openai": {
           "model": "gpt-4-turbo"  // Override just the model
         }
       }
     }
   }
   
   // Merged result:
   {
     "ai": {
       "providers": {
         "openai": {
           "api_key": "sk-global-key",  // From global
           "model": "gpt-4-turbo"        // From local
         }
       }
     }
   }
   ```

### Phase 4: Security Enhancements

1. **Warnings and Best Practices**
   - Warn when storing API keys in global config on shared systems
   - Suggest environment variables for sensitive data
   - Add config file permission checks (warn if world-readable)

2. **Optional Key Encryption**
   - Consider adding optional encryption for stored API keys
   - Use system keychain integration where available

### Phase 5: Migration and Utilities

1. **Migration Commands**
   ```bash
   # Copy current local config to global
   twrk aiconfig migrate-to-global
   
   # Copy global settings to current project
   twrk aiconfig copy-from-global
   
   # Clear global config
   twrk aiconfig clear --global
   ```

2. **First-Run Experience**
   - Detect when no config exists
   - Offer to set up global config on first AI command use

## Testing Strategy

1. **Unit Tests**
   - Config merging logic
   - File location resolution
   - Precedence ordering

2. **Integration Tests**
   - CLI commands with various flag combinations
   - Config file creation and updates
   - Migration commands

3. **Edge Cases**
   - Missing config files
   - Partial configurations
   - Permission issues
   - Circular references in config

## Security Considerations

1. **File Permissions**
   - Global config should be user-readable only (600)
   - Warn if permissions are too open

2. **API Key Storage**
   - Document security implications
   - Provide option to use env vars instead
   - Consider keychain integration for future

3. **Logging**
   - Never log API keys
   - Mask keys in --show output by default

## Migration Path

1. **Backward Compatibility**
   - Existing local configs continue to work
   - No breaking changes to current behavior

2. **Gradual Adoption**
   - Users can continue using local-only config
   - Global config is opt-in
   - Clear documentation for migration

## Future Enhancements

1. **Profiles**
   - Support multiple named profiles (like AWS CLI)
   - `twrk aiconfig --profile work`

2. **Team Sharing**
   - Separate secrets from preferences
   - Share non-sensitive config via git

3. **Config Sync**
   - Optional cloud sync for settings
   - Integration with secret managers

## Implementation Checklist

- [ ] Update ConfigManager for multi-source support
- [ ] Implement config merging logic
- [ ] Add --global flag to aiconfig command
- [ ] Create global config file management
- [ ] Add --show-origin flag
- [ ] Implement migration commands
- [ ] Update documentation
- [ ] Add comprehensive tests
- [ ] Security review
- [ ] Performance optimization for config loading

## Timeline

- Phase 1-2: Core implementation (2-3 days)
- Phase 3-4: Security and polish (1-2 days)
- Phase 5: Migration tools and docs (1 day)
- Testing and refinement: (1-2 days)

Total estimate: 1 week of development