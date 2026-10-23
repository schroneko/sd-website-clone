const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const lock = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');
const records = lock.split(/\n(?=\S)/);

function manifest(name) {
  let directory = path.dirname(require.resolve(name));
  for (;;) {
    const file = path.join(directory, 'package.json');
    if (fs.existsSync(file)) {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (value.name === name) return value;
    }
    const parent = path.dirname(directory);
    assert.notEqual(parent, directory, `Package manifest not found: ${name}`);
    directory = parent;
  }
}

function resolvedRecord(name, range, version) {
  const selector = `${name}@${range}`;
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const header = new RegExp(`(?:^|, )"?${escaped}"?(?:,|:)`);
  const record = records.find(value => header.test(value.split('\n')[0]));
  assert.ok(record, `Missing Yarn resolution for ${selector}`);
  assert.ok(record.includes(`\n  version "${version}"`), `Unexpected version for ${selector}`);
  assert.match(record, /\n  resolved "https:\/\//);
  assert.match(record, /\n  integrity sha(?:256|384|512)-\S+/);
}

test('Yarn locks every Next SWC platform and Sharp optional binary', () => {
  const next = manifest('next');
  const sharp = manifest('sharp');
  const swc = Object.entries(next.optionalDependencies).filter(([name]) => name.startsWith('@next/swc-'));
  assert.ok(swc.length > 1);
  for (const [name, version] of swc) resolvedRecord(name, version, version);
  resolvedRecord('sharp', next.optionalDependencies.sharp, sharp.version);
  const binaries = Object.entries(sharp.optionalDependencies);
  assert.ok(binaries.length > 1);
  for (const [name, version] of binaries) resolvedRecord(name, version, version);
});
