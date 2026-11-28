// Stable ZIP metadata avoids Terraform code updates caused only by file mtimes.
const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function archive(entries) {
  const files = [], directory = [];
  let offset = 0;
  for (const { name, bytes } of [...entries].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.startsWith('/') || name.split('/').includes('..')) throw new Error('Unsafe archive path');
    const filename = Buffer.from(name);
    const compressed = deflateRawSync(bytes, { level: 9 });
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8); // DEFLATE
    header.writeUInt16LE(33, 12); // 1980-01-01, midnight, independent of TZ
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    files.push(header, filename, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, central, end]);
}

function packageLambda(target) {
  if (!['api', 'db-bootstrap', 'merchant-registration'].includes(target)) throw new Error('Choose api, db-bootstrap or merchant-registration');
  const infra = path.resolve(__dirname, '..');
  const root = path.join(infra, target === 'db-bootstrap' ? 'db-bootstrap' : 'lambda');
  const bundle = target === 'merchant-registration' ? 'dist/merchant-registration.js' : 'dist/index.js';
  const entries = [
    { name: 'index.js', bytes: fs.readFileSync(path.join(root, bundle)) },
    { name: 'global-bundle.pem', bytes: fs.readFileSync(path.join(root, 'global-bundle.pem')) },
  ];
  if (target === 'db-bootstrap') {
    const migrations = path.join(infra, '../database/migrations');
    const names = fs.readdirSync(migrations).filter(name => /^[0-9]{4}_.+\.sql$/.test(name));
    if (!names.length) throw new Error('No database migrations found');
    for (const name of names) entries.push({ name: 'migrations/' + name, bytes: fs.readFileSync(path.join(migrations, name)) });
  }
  const destination = path.join(infra, 'terraform', target === 'merchant-registration' ? 'zayvi-preview-merchant-registration.zip' : `zayvi-${target === 'api' ? 'api-bootstrap' : 'db-bootstrap'}.zip`);
  fs.writeFileSync(destination, archive(entries));
  console.log(`Packaged ${target}: ${entries.length} files`);
}

module.exports = { archive, packageLambda };
if (require.main === module) packageLambda(process.argv[2]);
