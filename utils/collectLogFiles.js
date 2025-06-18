import path from 'node:path';
import { readdir } from 'node:fs/promises';

export default async function collectLogFiles(dirpath) {
    const entries = await readdir(dirpath, { withFileTypes: true });
  
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirpath, entry.name);
  
      if (entry.isDirectory() && entry.name !== '__MACOSX') {
        return collectLogFiles(fullPath);
      }
  
      if (entry.isFile() && entry.name.endsWith('.log')) {
        return [fullPath];
      }
  
      return [];
    }));
  
    return nested.flat();
}