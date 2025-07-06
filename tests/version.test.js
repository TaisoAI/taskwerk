/**
 * Version Tests
 * 
 * @description Tests to ensure version management is working correctly
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { VERSION, NAME } from '../src/version.js';

test('Version management', async (t) => {
  await t.test('version.js exists and has valid version', () => {
    assert.ok(VERSION, 'VERSION should be defined');
    assert.ok(NAME, 'NAME should be defined');
  });

  await t.test('version is not sentinel value', () => {
    assert.notEqual(VERSION, '0.0.0-dev', 'VERSION should not be sentinel value 0.0.0-dev');
    assert.notEqual(VERSION, 'UNKNOWN', 'VERSION should not be UNKNOWN');
  });

  await t.test('version follows semantic versioning', () => {
    assert.ok(VERSION.match(/^\d+\.\d+\.\d+$/), 'VERSION should match semantic versioning pattern');
  });

  await t.test('name is correct', () => {
    assert.equal(NAME, 'taskwerk', 'NAME should be taskwerk');
  });
});