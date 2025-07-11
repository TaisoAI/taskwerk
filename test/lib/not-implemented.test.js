import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notImplemented } from '../../src/lib/not-implemented.js';

describe('notImplemented', () => {
  let consoleLogSpy;
  let processExitSpy;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should log the correct not implemented message', () => {
    notImplemented('test-command', 'Test description');

    expect(consoleLogSpy).toHaveBeenCalledWith('Not implemented: test-command - Test description');
  });

  it('should exit with code 0', () => {
    notImplemented('test-command', 'Test description');

    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
