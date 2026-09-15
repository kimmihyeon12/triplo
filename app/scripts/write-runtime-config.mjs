/**
 * 배포 빌드 직전에 브라우저용 설정 파일을 만든다.
 *
 * 키는 저장소에 두지 않고 호스팅의 환경 변수로 주입한다. 값이 없으면 파일을 만들지
 * 않으며, 앱은 이미 '키 없음' 상태를 정상 처리하므로 빌드는 그대로 성공한다.
 * 로컬에서는 기존 public/app-config.json을 그대로 쓰므로 이 스크립트가 덮어쓰지 않는다.
 */
import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function write(name, value) {
  const target = join(publicDir, name);
  if (!value) {
    console.log(`[config] ${name}: 환경 변수 없음 — 건너뜀`);
    return;
  }
  if (await exists(target)) {
    console.log(`[config] ${name}: 기존 파일 유지`);
    return;
  }
  await mkdir(publicDir, { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
  console.log(`[config] ${name}: 환경 변수로 생성`);
}

const kakaoJsKey = process.env['KAKAO_JS_KEY']?.trim();
const supabaseUrl = process.env['SUPABASE_URL']?.trim();
const supabaseKey = process.env['SUPABASE_PUBLISHABLE_KEY']?.trim();

await write('app-config.json', kakaoJsKey ? { kakaoJsKey } : null);
await write(
  'supabase-config.json',
  supabaseUrl && supabaseKey
    ? {
        url: supabaseUrl,
        publishableKey: supabaseKey,
        accountDeletionEnabled: process.env['SUPABASE_DELETION_ENABLED'] === 'true',
      }
    : null,
);
