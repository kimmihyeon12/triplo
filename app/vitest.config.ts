import { defineConfig } from 'vitest/config';

// 도메인·저장소 순수 모듈 단위 테스트 전용. Angular 컴포넌트는 Playwright로 검증한다.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: false,
  },
});
