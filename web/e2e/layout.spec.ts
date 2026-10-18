import { expect, test } from './app';
import { PAGES } from './pages';
import { VIEWPORTS } from './viewports';

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const pageDef of PAGES) {
      test(`${pageDef.name} renders without horizontal overflow`, async ({ page, api }) => {
        api.seed('A note with a reasonably long title to check truncation in narrow layouts');
        await page.goto(pageDef.path);
        await expect(
          page.getByRole('heading', { level: pageDef.name === 'not-found' ? 2 : 1, name: pageDef.heading }),
        ).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}

test.describe('phone navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens the sidebar as a drawer and closes it on navigation', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await expect(sidebar).not.toBeInViewport();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(sidebar).toBeInViewport();
    await sidebar.getByRole('link', { name: 'Notes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible();
    await expect(sidebar).not.toBeInViewport();
  });
});

test.describe('desktop sidebar', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('collapses to an icon rail and remembers it', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    const wide = (await sidebar.boundingBox())!.width;

    await page.getByRole('button', { name: /Collapse sidebar/ }).click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide / 2);
    await sidebar.getByRole('link', { name: 'Notes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible();

    await page.reload();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(sidebar).not.toHaveAttribute('data-collapsed');
  });
});
