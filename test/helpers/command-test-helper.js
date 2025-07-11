import { vi, expect } from 'vitest';

export function setupCommandTest() {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

  return {
    consoleLogSpy,
    processExitSpy,
    cleanup: () => {
      consoleLogSpy.mockRestore();
      processExitSpy.mockRestore();
    },
  };
}

export function expectNotImplemented(consoleLogSpy, processExitSpy, commandName, description) {
  expect(consoleLogSpy).toHaveBeenCalledWith(`Not implemented: ${commandName} - ${description}`);
  expect(processExitSpy).toHaveBeenCalledWith(0);
}
