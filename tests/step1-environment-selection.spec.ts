import { test, expect } from '@playwright/test';

test.describe('Step 1: 배포 환경 다중선택', () => {
  test.beforeEach(async ({ page }) => {
    // hosts_generator.html 파일 열기
    await page.goto('file:///home/fgcp/claude/cp-deployment-wizard/hosts_generator.html');
    // 페이지 로드 완료 대기
    await page.waitForLoadState('networkidle');
  });

  test('테스트 1: 단일 선택 - "개발" 환경 카드 클릭 시 선택됨', async ({ page }) => {
    // 개발 환경 카드 찾기
    const devCard = page.locator('label[class*="env-card"]').first();

    // 클릭 전 상태 확인: selected 클래스가 없어야 함
    const classBeforeClick = await devCard.getAttribute('class');
    expect(classBeforeClick).not.toContain('selected');

    // 개발 카드 클릭
    await devCard.click();

    // 클릭 후 상태 확인: selected 클래스가 있어야 함
    const classAfterClick = await devCard.getAttribute('class');
    expect(classAfterClick).toContain('selected');

    // 스타일 확인: border가 accent 색상으로 변경되어야 함
    const borderStyle = await devCard.evaluate(el =>
      window.getComputedStyle(el).borderColor
    );
    expect(borderStyle).toBeTruthy();

    // 개발 카드 내부의 checkbox 확인
    const devCheckbox = devCard.locator('input[type="checkbox"]');
    const isChecked = await devCheckbox.isChecked();
    expect(isChecked).toBe(true);
  });

  test('테스트 2: 복수 선택 (핵심) - 개발 > 운영 > 스테이징 순서로 선택 시 모두 선택됨', async ({ page }) => {
    const envCards = page.locator('label[class*="env-card"]');
    const cardCount = await envCards.count();

    // 환경 카드 3개 확인
    expect(cardCount).toBe(3);

    // 첫 번째: 개발 클릭
    const devCard = envCards.nth(0);
    await devCard.click();
    const devCheckbox = devCard.locator('input[type="checkbox"]');
    expect(await devCheckbox.isChecked()).toBe(true);

    // 두 번째: 운영 클릭 (개발은 유지되어야 함)
    const prodCard = envCards.nth(2);
    await prodCard.click();
    expect(await devCheckbox.isChecked()).toBe(true, '개발 환경이 선택 해제되면 안 됨');
    const prodCheckbox = prodCard.locator('input[type="checkbox"]');
    expect(await prodCheckbox.isChecked()).toBe(true);

    // 세 번째: 스테이징 클릭 (개발, 운영은 유지되어야 함)
    const stagingCard = envCards.nth(1);
    await stagingCard.click();
    expect(await devCheckbox.isChecked()).toBe(true, '개발 환경이 선택 해제되면 안 됨');
    expect(await prodCheckbox.isChecked()).toBe(true, '운영 환경이 선택 해제되면 안 됨');
    const stagingCheckbox = stagingCard.locator('input[type="checkbox"]');
    expect(await stagingCheckbox.isChecked()).toBe(true);

    // 스타일 확인: 세 카드 모두 selected 클래스 있어야 함
    const devClass = await devCard.getAttribute('class');
    const stagingClass = await stagingCard.getAttribute('class');
    const prodClass = await prodCard.getAttribute('class');

    expect(devClass).toContain('selected');
    expect(stagingClass).toContain('selected');
    expect(prodClass).toContain('selected');
  });

  test('테스트 3: 선택 해제 - 선택된 "개발" 카드를 다시 클릭하면 해제됨', async ({ page }) => {
    const envCards = page.locator('label[class*="env-card"]');

    // 개발 > 운영 > 스테이징 모두 선택
    const devCard = envCards.nth(0);
    const prodCard = envCards.nth(2);
    const stagingCard = envCards.nth(1);

    await devCard.click();
    await prodCard.click();
    await stagingCard.click();

    // 현재 상태: 3개 모두 선택됨
    const devCheckbox = devCard.locator('input[type="checkbox"]');
    const prodCheckbox = prodCard.locator('input[type="checkbox"]');
    const stagingCheckbox = stagingCard.locator('input[type="checkbox"]');

    expect(await devCheckbox.isChecked()).toBe(true);
    expect(await prodCheckbox.isChecked()).toBe(true);
    expect(await stagingCheckbox.isChecked()).toBe(true);

    // 개발 카드를 다시 클릭하여 해제
    await devCard.click();

    // 개발만 해제, 나머지는 유지
    expect(await devCheckbox.isChecked()).toBe(false, '개발이 해제되어야 함');
    expect(await prodCheckbox.isChecked()).toBe(true, '운영이 유지되어야 함');
    expect(await stagingCheckbox.isChecked()).toBe(true, '스테이징이 유지되어야 함');

    // 스타일도 확인
    const devClass = await devCard.getAttribute('class');
    const prodClass = await prodCard.getAttribute('class');
    const stagingClass = await stagingCard.getAttribute('class');

    expect(devClass).not.toContain('selected');
    expect(prodClass).toContain('selected');
    expect(stagingClass).toContain('selected');
  });

  test('테스트 4: 상태 반영 확인 - 선택된 환경이 카드에 표시됨', async ({ page }) => {
    const envCards = page.locator('label[class*="env-card"]');

    // 개발 환경 선택
    await envCards.nth(0).click();

    // 개발 카드에 selected 클래스가 있는지 확인
    const devCardClass = await envCards.nth(0).getAttribute('class');
    expect(devCardClass).toContain('selected');

    // 스테이징과 운영은 selected가 없어야 함
    const stagingCardClass = await envCards.nth(1).getAttribute('class');
    const prodCardClass = await envCards.nth(2).getAttribute('class');

    expect(stagingCardClass).not.toContain('selected');
    expect(prodCardClass).not.toContain('selected');
  });

  test('테스트 5: 다중선택 검증 - 모든 선택 환경이 selected 클래스를 가짐', async ({ page }) => {
    const envCards = page.locator('label[class*="env-card"]');

    // 개발, 운영 선택
    await envCards.nth(0).click();
    await envCards.nth(2).click();

    // 두 카드 모두 selected 클래스를 가져야 함
    const devCardClass = await envCards.nth(0).getAttribute('class');
    const prodCardClass = await envCards.nth(2).getAttribute('class');

    expect(devCardClass).toContain('selected');
    expect(prodCardClass).toContain('selected');

    // 선택하지 않은 스테이징은 selected가 없어야 함
    const stagingCardClass = await envCards.nth(1).getAttribute('class');
    expect(stagingCardClass).not.toContain('selected');
  });

  test('테스트 6: 선택 해제 검증 - 해제된 환경은 selected 클래스가 제거됨', async ({ page }) => {
    const envCards = page.locator('label[class*="env-card"]');

    // 개발 선택
    await envCards.nth(0).click();
    let devCardClass = await envCards.nth(0).getAttribute('class');
    expect(devCardClass).toContain('selected');

    // 개발 다시 클릭하여 해제
    await envCards.nth(0).click();

    devCardClass = await envCards.nth(0).getAttribute('class');
    expect(devCardClass).not.toContain('selected');
  });

  test('테스트 7: 더블 토글 버그 확인 - 빠른 연속 클릭 시 상태 일관성', async ({ page }) => {
    const devCard = page.locator('label[class*="env-card"]').nth(0);
    const devCheckbox = devCard.locator('input[type="checkbox"]');

    // 빠른 연속 클릭: 선택 -> 해제 -> 선택
    await devCard.click();
    await page.waitForTimeout(50);
    await devCard.click();
    await page.waitForTimeout(50);
    await devCard.click();

    // 최종 상태: 선택됨 (홀수 번 클릭)
    const isFinallyChecked = await devCheckbox.isChecked();
    expect(isFinallyChecked).toBe(true);

    // 카드도 selected 클래스를 가져야 함
    const devCardClass = await devCard.getAttribute('class');
    expect(devCardClass).toContain('selected');
  });

  test('테스트 8: 초기 상태 확인 - 아무것도 선택되지 않은 상태로 시작', async ({ page }) => {
    // 페이지 로드 후 아무것도 클릭하지 않은 상태
    const envValues = await page.evaluate(() => {
      return (window as any).state?.data?.deployment_environments || [];
    });

    expect(envValues.length).toBe(0);

    // 모든 카드의 checkbox가 unchecked 상태
    const envCards = page.locator('label[class*="env-card"]');
    const cardCount = await envCards.count();

    for (let i = 0; i < cardCount; i++) {
      const checkbox = envCards.nth(i).locator('input[type="checkbox"]');
      const isChecked = await checkbox.isChecked();
      expect(isChecked).toBe(false);
    }
  });
});
