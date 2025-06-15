const streams = {};

import fs from 'node:fs';
import build from 'pino-abstract-transport';

import timestampWithTimeZone from './timestampWithTimeZone.js';

const labels = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
  infinity: 'silent',
};

const generator = () => () => `${timestampWithTimeZone().split('T')[0].replace(/:/g, '_')}.log`;

const {
  dir = 'log', interval = '1d', compress = 'gzip', // maxFiles = 90, local: teeToStdout,
} = {};
function createFileStream({ level, status }) {
  console.log(dir, level, generator({ interval })(), interval, compress);

  const dt = new Date().toISOString().split('T')[0];

  const fileName = `${dir}/${level}/${dt}${status ? `_${status}` : ''}.log`;

  fs.mkdirSync(`${dir}/${level}`, { recursive: true });

  const stream = fs.createWriteStream(fileName, {
    encoding: 'utf8', flags: 'a+',
  });

  stream.on('finish', () => stream.destroy());
  stream.on('close', () => stream.destroy());
  stream.on('error', () => stream.destroy());
  return stream;
}

setInterval(() => {
  const dt = new Date().toISOString().split('T')[0];
  Object.keys(streams).filter(el => !el.includes(dt)).forEach(el => streams[el].destroy());
}, 1000 * 3600 * 2);

export default function transportTarget() {
  return build((source) => {
    const dt = new Date().toISOString().split('T')[0];
    source.on('data', (obj) => {
      if (['incoming request', 'request completed'].includes(obj.msg)) return;

      // console.log(obj)
      const file = obj.msg?.logfolder || obj.logfolder;

      const level = file || labels[obj.level];
      const lvl = level + dt;

      // write error status
      if (obj.err?.status) {
        const status = obj.err?.status;
        streams[status] = streams[status] || createFileStream({ level, status });
        streams[status].write(`${JSON.stringify({ ...obj, level: labels[obj.level] })}\n`);
      }

      // write error type
      if (obj.err?.type) {
        const status = obj.err?.type;
        streams[status] = streams[status] || createFileStream({ level, status });
        streams[status].write(`${JSON.stringify({ ...obj, level: labels[obj.level] })}\n`);
      }

      if (streams[lvl]?.closed) { streams[lvl].destroy(); }
      if (streams[lvl]?.destroyed) { delete streams[lvl]; }

      streams[lvl] = streams[lvl] || createFileStream({ level });
      streams[lvl].write(`${JSON.stringify({ ...obj, level: labels[obj.level] })}\n`);
    });
  }, {
    parseLine: (line) => JSON.parse(line),
  });
}
