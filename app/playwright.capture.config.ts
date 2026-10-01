import base from './playwright.config';
import { defineConfig } from '@playwright/test';

// 사용법 캡처 전용. 일반 테스트에는 들어가지 않는다(e2e/guide.capture.ts).
export default defineConfig({
  ...base,
  testMatch: '**/*.capture.ts',
  projects: [{ name: 'capture' }],
});
