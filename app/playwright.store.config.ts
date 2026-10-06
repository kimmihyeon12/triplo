import base from './playwright.config';
import { defineConfig } from '@playwright/test';

// 스토어 이미지 캡처 전용(e2e/store.shots.ts). 지도·장소 검색이 실제 카카오인 store 빌드를 4200에서 띄운다.
// 카카오 지도 키는 등록한 도메인(localhost:4200)에서만 동작한다.
export default defineConfig({
  ...base,
  testMatch: '**/store.shots.ts',
  use: { ...base.use, baseURL: 'http://localhost:4200' },
  projects: [{ name: 'store' }],
  webServer: {
    command: 'npx ng serve --configuration store --watch=false --live-reload=false',
    url: 'http://localhost:4200',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
