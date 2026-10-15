import { promises as fs } from 'node:fs';
import path from 'node:path';

function linkedPaths(markdown) {
  const links = [];
  for (const match of markdown.matchAll(/!?\[[^\]\r\n]*\]\((?:<([^>\r\n]+)>|([^\s)\r\n]+))(?:\s+[^)]*)?\)/g)) {
    links.push(match[1] ?? match[2]);
  }
  for (const match of markdown.matchAll(/^\s*\[[^\]\r\n]+\]:\s*(?:<([^>\r\n]+)>|([^\s\r\n]+))/gm)) {
    links.push(match[1] ?? match[2]);
  }
  for (const match of markdown.matchAll(/\bhref=["']([^"']+)["']/g)) links.push(match[1]);
  return links;
}

export async function verifyPortableDocLinks(bundle, manifestPaths) {
  const packaged = new Set(manifestPaths);
  let markdownFilesVerified = 0;
  let localLinksVerified = 0;
  for (const file of packaged) {
    if (!file.endsWith('.md')) continue;
    markdownFilesVerified++;
    const markdown = await fs.readFile(path.join(bundle, file), 'utf8');
    for (const link of linkedPaths(markdown)) {
      if (/^(?:https?:|mailto:|\/\/|#)/i.test(link)) continue;
      if (/^[a-z][a-z\d+.-]*:/i.test(link) || link.startsWith('/')) {
        throw new Error(`Unsupported local link in ${file}: ${link}`);
      }
      let decoded;
      try { decoded = decodeURIComponent(link.split(/[?#]/, 1)[0]); }
      catch { throw new Error(`Invalid link encoding in ${file}: ${link}`); }
      if (!decoded) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded));
      if (target === '..' || target.startsWith('../') || !packaged.has(target)) {
        throw new Error(`Missing packaged link in ${file}: ${link} -> ${target}`);
      }
      await fs.access(path.join(bundle, target));
      localLinksVerified++;
    }
  }
  return { markdownFilesVerified, localLinksVerified };
}
