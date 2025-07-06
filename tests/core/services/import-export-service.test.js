/**
 * Import/Export Service Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import ImportExportService from '../../../src/core/services/import-export-service.js';

test('ImportExportService', async (t) => {
  let service;

  t.beforeEach(() => {
    service = new ImportExportService();
  });

  await t.test('constructor creates instance', () => {
    assert.ok(service instanceof ImportExportService);
  });

  await t.test('exportTasks throws not implemented', async () => {
    await assert.rejects(
      service.exportTasks({ format: 'json' }),
      /Not implemented/
    );
  });

  await t.test('importTasks throws not implemented', async () => {
    await assert.rejects(
      service.importTasks({ data: '[]' }),
      /Not implemented/
    );
  });

  await t.test('exportToFile throws not implemented', async () => {
    await assert.rejects(
      service.exportToFile('/tmp/export.json'),
      /Not implemented/
    );
  });
});