/**
 * 배포할 때 공지 초안을 만든다. 관리자는 /admin/notices에서 다듬어 직접 발행한다.
 *
 *   node app/scripts/release-notice-draft.mjs v0.10.4 release-notes.txt
 *
 * 메모 파일의 첫 줄은 제목, 나머지는 본문이다. 사용자에게 보일 글이라 짧게
 * "-" 목록으로 쓴다. 연결된 Supabase 프로젝트(supabase link)에 CLI로 넣는다.
 * 같은 태그의 자동 초안은 서버가 한 번만 만든다(release_notice_draft).
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [tag, notesPath] = process.argv.slice(2);
if (!tag || !notesPath || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('사용법: node app/scripts/release-notice-draft.mjs v0.10.4 release-notes.txt');
  process.exit(1);
}

const text = (await readFile(notesPath, 'utf8')).replace(/\r\n/g, '\n').trim();
const [title = '', ...rest] = text.split('\n');
const body = rest.join('\n').trim();
if (!title.trim() || title.trim().length > 100 || !body || body.length > 5000) {
  console.error('첫 줄 제목(1~100자)과 본문(1~5000자)이 필요합니다.');
  process.exit(1);
}

// 글에 어떤 따옴표가 있어도 SQL이 깨지지 않게 매번 다른 달러 인용 표시를 쓴다.
const q = `$n${randomBytes(6).toString('hex')}$`;
const sql = `select public.release_notice_draft(${q}${tag}${q}, ${q}${title.trim()}${q}, ${q}${body}${q}) as id;`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// SQL은 파일로 넘긴다. Windows 셸은 인자 안의 공백·따옴표를 다시 나눠 글을 깨뜨린다.
const dir = await mkdtemp(join(tmpdir(), 'release-notice-'));
const file = join(dir, 'draft.sql');
await writeFile(file, sql, 'utf8');
const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--output-format', 'json', '-f', file], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
await rm(dir, { recursive: true, force: true });
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}
const created = /"id":\s*"[0-9a-f-]{36}"/.test(result.stdout);
console.log(created ? `${tag} 공지 초안을 만들었습니다.` : `${tag} 공지 초안이 이미 있어 새로 만들지 않았습니다.`);
