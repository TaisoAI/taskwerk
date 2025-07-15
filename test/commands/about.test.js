import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aboutCommand } from '../../src/commands/about.js';
import packageInfo from '../../src/version.js';

describe('About Command', () => {
  let consoleLogSpy;
  let originalConsoleLog;

  beforeEach(() => {
    originalConsoleLog = console.log;
    consoleLogSpy = vi.fn();
    console.log = consoleLogSpy;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should create a command with correct name and description', () => {
    const command = aboutCommand();

    expect(command.name()).toBe('about');
    expect(command.description()).toBe('Display information about Taskwerk');
  });

  it('should display package information when executed', () => {
    const command = aboutCommand();

    // Parse empty args to trigger the action
    command.parse([], { from: 'user' });

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');

    // Check ASCII banner
    expect(output).toContain('████████╗');
    expect(output).toContain('███████╗██╗  ██╗██╗    ██╗███████╗██████╗'); // Part of ASCII art

    // Check version line
    expect(output).toContain(`taskwerk v${packageInfo.version}`);
    expect(output).toContain('by Taiso.AI');

    // Check package info
    expect(output).toContain('📦 Package Information:');
    expect(output).toContain(`Name: ${packageInfo.name}`);
    expect(output).toContain(`Version: ${packageInfo.version}`);
    expect(output).toContain(`About: ${packageInfo.description}`);
    expect(output).toContain(`License: ${packageInfo.license}`);

    // Check other sections
    expect(output).toContain('🔗 Project Links:');
    expect(output).toContain('🤖 AI Integration:');
    expect(output).toContain('🚀 Quick Start:');
    expect(output).toContain('📚 Get Help:');
    expect(output).toContain('💡 Built with love for developers who ship great software! 🎯');
  });

  it('should display ASCII banner', () => {
    const command = aboutCommand();

    // Parse empty args to trigger the action
    command.parse([], { from: 'user' });

    const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');

    expect(output).toContain('████████╗ █████╗ ███████╗██╗  ██╗██╗    ██╗███████╗██████╗ ██╗  ██╗');
    expect(output).toContain('╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝██║    ██║██╔════╝██╔══██╗██║ ██╔╝');
  });

  it('should handle all properties from package info', () => {
    const command = aboutCommand();

    expect(() => command.parse([], { from: 'user' })).not.toThrow();
  });
});
