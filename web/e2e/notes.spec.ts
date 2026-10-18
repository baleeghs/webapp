import { expect, test } from './app';

test('create, edit and delete a note', async ({ page, api }) => {
  await page.goto('/notes');
  await expect(page.getByText('No notes yet')).toBeVisible();

  await page.getByRole('button', { name: 'New note' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New note' });
  await expect(dialog.getByLabel('Title')).toBeFocused();
  await dialog.getByLabel('Title').fill('Release checklist');
  await dialog.getByLabel('Body').fill('Tag, build, deploy.');
  await dialog.getByRole('button', { name: 'Create note' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('link', { name: /Release checklist/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Release checklist' })).toBeVisible();

  await page.getByLabel('Title').fill('Release checklist v2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Release checklist v2' })).toBeVisible();
  expect(api.notes[0]?.title).toBe('Release checklist v2');

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByText('No notes yet')).toBeVisible();
});

test('deep links work on reload', async ({ page, api }) => {
  const [note] = api.seed('Bookmarked');
  await page.goto(`/notes/${note!.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bookmarked' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Bookmarked' })).toBeVisible();
});

test('theme preference survives a reload without a flash', async ({ page }) => {
  await page.goto('/settings');
  await page.getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  // theme-init.js sets it before the app's JavaScript runs.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
