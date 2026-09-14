import { expect, test } from '@playwright/test';

test('스피너는 열린 테두리가 실제 회전하며 모션 감소 설정을 존중한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/lab');
  const spinner = page.getByRole('status', { name: '로딩 예제' }).locator('.loading-spinner');
  await expect(spinner).toHaveCSS('border-right-color', 'rgba(0, 0, 0, 0)');
  await expect(spinner).toHaveCSS('animation-name', 'spin');
  const transform = await spinner.evaluate((el) => getComputedStyle(el).transform);
  await expect.poll(() => spinner.evaluate((el) => getComputedStyle(el).transform)).not.toBe(transform);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(spinner).toHaveCSS('animation-name', 'none');
});

test('실험실의 실제 공통 컴포넌트로 입력·로딩·토스트를 확인한다', async ({ page }) => {
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: '디자인 시스템', exact: true })).toBeVisible();
  await expect(page.getByTestId('lab-disabled')).toBeDisabled();
  await page.getByTestId('lab-loading').click();
  await expect(page.getByTestId('lab-loading')).toBeDisabled();
  await expect(page.getByTestId('lab-loading').locator('app-spinner')).toBeVisible();
  await expect(page.getByTestId('lab-loading')).toBeEnabled();
  await page.getByLabel('예제 닉네임', { exact: true }).fill('여행친구');
  await page.getByRole('button', { name: '오류 토스트 보기' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '저장하지 못했습니다' })).toBeVisible();
  await page.getByRole('button', { name: '오류 알림 닫기' }).click();
  await expect(page.getByTestId('error-toast')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('실험실 입력은 공통 토큰과 키보드 포커스를 사용한다', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('link', { name: '입력폼', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:4300/lab');
  const input = page.getByLabel('예제 닉네임', { exact: true });
  await input.focus();
  await expect(input).toBeFocused();
  const values = await input.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      height: style.height,
      radius: style.borderRadius,
      width: el.getBoundingClientRect().width,
      color: getComputedStyle(document.documentElement)
        .getPropertyValue('--color-accent-deep')
        .trim(),
    };
  });
  expect(values.height).toBe('44px');
  expect(values.radius).toBe('10px');
  expect(values.color).toBe('#2f5fdb');
  expect(values.width).toBeGreaterThan(200);
});

test('비활성 링크는 라우팅과 템플릿 클릭을 모두 차단한다', async ({ page }) => {
  await page.goto('/lab');
  await page.getByTestId('lab-disabled-link').dispatchEvent('click');
  await expect(page).toHaveURL('http://localhost:4300/lab');
  await expect(page.getByTestId('lab-link-clicks')).toContainText('0');
});
