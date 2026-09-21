import { expect, test } from 'vitest';
import {
  fileChanges,
  inventoryDigest,
  pathMatches,
  type FileEntry,
} from '../packages/core/src/index.js';
const f = (path: string, digest = 'one', mode = '100644'): FileEntry => ({
  path,
  digest,
  mode,
  size: 1,
  category: 'unmodeled',
});
test('full inventory tracks additions, removals, byte and mode changes', () => {
  expect(
    fileChanges(
      [f('deleted'), f('config.json'), f('script')],
      [f('asset.png'), f('config.json', 'two'), f('script', 'one', '100755')],
    ).map((x) => [x.path, x.change]),
  ).toEqual([
    ['asset.png', 'added'],
    ['config.json', 'changed'],
    ['deleted', 'removed'],
    ['script', 'changed'],
  ]);
  expect(inventoryDigest([f('a'), f('b')])).toBe(
    inventoryDigest([f('b'), f('a')]),
  );
  expect(inventoryDigest([f('config.json')])).not.toBe(
    inventoryDigest([f('config.json', 'two')]),
  );
});
test.each([
  ['src/a.ts', 'src/*.ts', true],
  ['src/nested/a.ts', 'src/*.ts', false],
  ['src/a.ts', 'src/**/*.ts', true],
  ['src/nested/a.ts', 'src/**/*.ts', true],
  ['package.json', 'src/**', false],
  ['src/a.ts', '**', true],
  ['src/a.ts', 'src/?.ts', true],
  ['file[1].ts', 'file[1].ts', true],
])('path glob %s %s', (path, pattern, result) =>
  expect(pathMatches(path, pattern)).toBe(result),
);
