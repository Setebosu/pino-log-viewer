import pino from 'pino';
import Fastify from 'fastify';

import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'url';
import { lstat, rm } from 'node:fs/promises';

import {
  createReadStream, existsSync, mkdirSync, readdirSync,
} from 'node:fs';

import AdmZip from 'adm-zip';

import timestampWithTimeZone from './utils/timestampWithTimeZone.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(dirname, 'public');
const logsDir = path.join(dirname, 'log');

const limit = 200000;

const logger = pino({
  level: 'trace', // minimal log level to write
  timestamp: () => `,"time":"${timestampWithTimeZone()}"`, // timestamp as isostring
  transport: {
    targets: [
      {
        target: './utils/createFileStream.js',
      },
    ],
  },
  redact: [],
});

const app = Fastify({ loggerInstance: logger });

const host = '0.0.0.0';
const port = 3000;

await app.register(import('@fastify/static'), { root: rootDir, prefix: '/' }); // pages
await app.register(import('@fastify/multipart'), {
  limits: {
    fileSize: 50 * 1024 * 1024, // 500 MB limit
  }
}); // upload parser

app.post('/upload', async (req, reply) => {
  await rm(logsDir, { recursive: true, force: true });
  mkdirSync(logsDir, { recursive: true });
  const parts = req.parts();
  const part = await parts.next();

  if (!part || !part.value || !part.value.filename.endsWith('.zip')) {
    return reply.status(400).send('No .zip file uploaded');
  }

  // const buffer = await part.toBuffer();
  const buffer = await part.value.toBuffer();
  const zip = new AdmZip(buffer);
  zip.extractAllTo(logsDir, true);

  return reply.status(200).send('Zip extracted to logs folder');
});

app.get('/clear-logs', async (req, reply) => {
  await rm(logsDir, { recursive: true, force: true });
  return reply.status(200).send('All logs deleted');
});

app.get('/logger-file/*', async (req, reply) => {
  const { level } = req.query || {};
  mkdirSync(logsDir, { recursive: true });

  const filepath = path.join(logsDir, req.params['*'] || '');

  if (!existsSync(filepath)) {
    return reply.status(404).send('file not exists');
  }

  const stat = await lstat(filepath);
  const isFile = stat.isFile();

  console.log('isFile', isFile, filepath, stat.size);

  if (isFile) {
    const lines = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: createReadStream(filepath, { start: stat.size > limit ? stat.size - limit : 0 }),
      });
      const lines1 = [];
      rl.on('close', () => resolve(lines1));
      rl.on('line', (line) => {
        try {
          lines1.push(JSON.parse(line.replace(/\u0000/g, '')))
        } catch (err) {
          console.error('Error parsing line:', err.toString(), line);
          lines1.push({ msg: line, level: 'error', parse: false }); // Store raw line if parsing fails
        }
      });
    });

    const rows = level ? lines.filter(line => line.level && line.level === level) : lines;

    reply.headers({ 'Content-type': 'application/json; charset=UTF-8' });

    const result = stat.size > limit && rows.length > 1
      ? rows.reverse().slice(0, -1)
      : rows.reverse();

    return reply.status(200).send(result);
  }

  const content = readdirSync(filepath, { withFileTypes: true });

  const list = await Promise.all(content.map(async item => (
    {
      name: item.name,
      type: item.isDirectory() ? 'dir' : 'file',
      size: item.isFile() ? (await lstat(path.join(filepath, item.name))).size : 0,
      path: path.join(req.params['*'] || '', item.name).replace(/\\/g, '/')
    })));

  return list;
});

// Start server
app.listen({ host, port }, err => {
  if (err) {
    console.error(err.toString());
    logger.error(err);
    process.exit(1);
  }
  console.log(`Server running at http://${host}:${port}`);
});
