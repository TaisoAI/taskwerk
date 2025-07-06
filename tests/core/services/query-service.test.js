/**
 * Query Service Tests
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import QueryService from '../../../src/core/services/query-service.js';

test('QueryService', async (t) => {
  let service;

  t.beforeEach(() => {
    service = new QueryService();
  });

  await t.test('constructor creates instance', () => {
    assert.ok(service instanceof QueryService);
  });

  await t.test('search throws not implemented', async () => {
    await assert.rejects(
      service.search({ query: 'test' }),
      /Not implemented/
    );
  });

  await t.test('getTasksByStatus throws not implemented', async () => {
    await assert.rejects(
      service.getTasksByStatus('active'),
      /Not implemented/
    );
  });

  await t.test('getTasksByDate throws not implemented', async () => {
    await assert.rejects(
      service.getTasksByDate({ from: new Date() }),
      /Not implemented/
    );
  });

  await t.test('getTasksByTag throws not implemented', async () => {
    await assert.rejects(
      service.getTasksByTag('bug'),
      /Not implemented/
    );
  });

  await t.test('getTasksByProject throws not implemented', async () => {
    await assert.rejects(
      service.getTasksByProject('project-1'),
      /Not implemented/
    );
  });
});