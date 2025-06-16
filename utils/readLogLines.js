import readline from 'node:readline';
import { lstat } from 'node:fs/promises';

import { createReadStream } from 'node:fs';

const limit = 200000; // ~20MB

export default async function readLogLines(filepath, level) {
    const { size = 0 } = await lstat(filepath);
    const startOffset = size > limit ? size - limit : 0;
  
    return new Promise((resolve) => {
      const stream = createReadStream(filepath, { start: startOffset });
      const rl = readline.createInterface({ input: stream });
  
      const lines = [];
  
      rl.on('line', (line) => {
        const cleaned = line.replace(/\u0000/g, '');
        try {
          const log = JSON.parse(cleaned);
          if (level && log.level && log.level.toLowerCase() !== level.toLowerCase()) { return; }
          lines.push(log);
        } catch (err) {
          console.error('Error parsing line:', err.message, cleaned);
          lines.push({ msg: cleaned, level: 'error', parse: false });
        }
        if (lines.length >= limit) {
          rl.close(); // stop reading more
          stream.destroy(); // close stream early
        }
      });
  
      rl.on('close', () => resolve(lines));
    });
}
  