/**
 * 빌드 직전에 버전 정보를 파일로 남긴다.
 *
 * 배포된 화면을 열었을 때 그것이 어느 커밋인지 알 수 있어야 한다. 그렇지 않으면
 * 고친 것이 실제로 올라갔는지 매번 짐작해야 한다.
 *
 * 버전은 git 태그에서 읽는다. 태그가 없으면 커밋 해시만 적는다. git이 없는
 * 환경(호스팅 빌드 등)에서는 환경 변수를 쓰고, 그것도 없으면 '알 수 없음'으로
 * 둔다. 버전을 못 읽는다고 빌드를 멈추지는 않는다.
 *
 * 호스팅은 저장소를 얕게 복제해 태그를 받지 않는다. 그래서 git에서 태그를
 * 못 읽는 경우가 있다(2026-09-17 v0.1.0 배포에서 확인). 배포 태그를
 * `app/RELEASE` 파일에도 적어 두고, git이 비었으면 그 값을 쓴다.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(args) {
  try {
    return execFileSync('git', args, { cwd: appDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function releaseFile() {
  try {
    return (await readFile(join(appDir, 'RELEASE'), 'utf8')).trim();
  } catch {
    return '';
  }
}

/** Cloudflare Pages는 CF_PAGES_COMMIT_SHA로 커밋을 알려 준다. */
const envCommit = process.env['CF_PAGES_COMMIT_SHA'] ?? '';
const commit = git(['rev-parse', '--short', 'HEAD']) || envCommit.slice(0, 7);
// 태그가 이 커밋에 정확히 붙어 있으면 그 이름을, 아니면 '가장 가까운 태그+거리'를 쓴다.
const described = git(['describe', '--tags', '--always', '--dirty']);
const tag = git(['describe', '--tags', '--abbrev=0']) || (await releaseFile());

const version = {
  /**
   * 사람이 읽는 배포 이름. 예: v0.3.0, v0.3.0-4-gabc1234
   *
   * git describe를 먼저 쓴다. 태그가 붙은 커밋이면 태그 이름이, 그 뒤 커밋이면
   * '태그-거리-해시'가 나온다. 얕은 복제라 describe가 해시만 돌려주면 RELEASE
   * 파일의 태그를 쓴다. 둘 다 없으면 해시라도 보여준다.
   */
  name: (described && described !== commit ? described : tag) || commit || '알 수 없음',
  /** 가장 가까운 태그. 없으면 빈 문자열. */
  tag,
  commit,
  builtAt: new Date().toISOString(),
};

const file = `// 빌드가 만드는 파일이다. 직접 고치지 않는다. scripts/write-version.mjs를 본다.
export const APP_VERSION = ${JSON.stringify(version, null, 2)} as const;
`;

await writeFile(join(appDir, 'src', 'app', 'core', 'version.ts'), file, 'utf8');
console.log(`version: ${version.name} (${version.builtAt})`);
