/**
 * 배포된 화면이 어느 것인지 알리는 버전.
 *
 * 이 파일의 값은 개발용 기본값이다. 배포 빌드(`npm run build:deploy`)가
 * `scripts/write-version.mjs`로 실제 태그·커밋을 채워 덮어쓴다. 저장소에
 * 기본값을 두는 이유는 스크립트를 돌리지 않고 빌드해도 깨지지 않게 하기
 * 위해서다.
 */
export const APP_VERSION = {
  name: '개발 중',
  tag: '',
  commit: '',
  builtAt: '',
} as const;
