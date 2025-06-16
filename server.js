import pino from 'pino';
import Fastify from 'fastify';

import path from 'node:path';
import { fileURLToPath } from 'url';
import { existsSync } from 'node:fs';
import { lstat, rm, mkdir, readdir } from 'node:fs/promises';

import AdmZip from 'adm-zip';

import timestampWithTimeZone from './utils/timestampWithTimeZone.js';
import readLogLines from './utils/readLogLines.js';
import collectLogFiles from './utils/collectLogFiles.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(dirname, 'public');
const logsDir = path.join(dirname, 'log');

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
  await mkdir(logsDir, { recursive: true });
  const parts = req.parts();
  const part = await parts.next();

  if (!part || !part.value || !part.value.filename.endsWith('.zip')) {
    return reply.status(400).send('No .zip file uploaded');
  }

  const buffer = await part.value.toBuffer();
  const zip = new AdmZip(buffer);
  zip.extractAllTo(logsDir, true);

  return reply.status(200).send('Zip extracted to logs folder');
});

const cache = {};

app.delete('/logs/*', async (req, reply) => {
  const filepath = path.join(logsDir, req.params['*'] || '');
  await rm(filepath, { recursive: true, force: true });
  await mkdir(logsDir, { recursive: true });
  Object.keys(cache).forEach(key => delete cache[key]); // clear cache
  return reply.status(200).send('logs deleted successfully');
});

app.get('/logs/*', async (req, reply) => {
  const { level, list } = req.query || {};

  const filepath = path.join(logsDir, req.params['*'] || '');

  if (!existsSync(filepath)) {
    return reply.status(404).send('file not exists');
  }

  const stat = await lstat(filepath);
  const isFile = stat.isFile();

  if (isFile) {
    const rows = cache[filepath] || await readLogLines(filepath, level);
    if (!cache[filepath]) { cache[filepath] = rows; }
    return reply.headers({ 'Content-type': 'application/json; charset=UTF-8' }).send(rows);
  }

  // to browse between log subdirectories and files
  if (list) {
    const content = cache[filepath] ? [] : await readdir(filepath, { withFileTypes: true });
    const list = cache[filepath] || await Promise.all(content.map(async item => (
      {
        name: item.name,
        type: item.isDirectory() ? 'dir' : 'file',
        size: item.isFile() ? (await lstat(path.join(filepath, item.name))).size : 0,
        path: path.join(req.params['*'] || '', item.name).replace(/\\/g, '/')
      })));
  
    if (!cache[filepath]) { cache[filepath] = list; }
    return list;
  }

  // to collect log files and read them
  const logFiles = stat.isDirectory() 
    ? await collectLogFiles(filepath) 
    : [filepath];

  const allLogs = (await Promise.all(logFiles.map(fp => readLogLines(fp, level)))).flat();
  return allLogs;
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
