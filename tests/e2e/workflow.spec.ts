import { test, expect } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
test('campaign, PDF, session review, report, player correction and amended publication', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const dm = await browser.newContext();
  const page = await dm.newPage();
  await page.goto('/');
  await page.getByLabel('Email address').fill('dm@aar.local');
  await page.getByLabel('Password', { exact: true }).fill('Adventure!2026');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Your next chapter starts here.' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings & audit', exact: true }).click();
  await page.getByRole('button', { name: 'Create another campaign' }).click();
  await page.getByLabel('Campaign name').fill('Browser test ' + Date.now());
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const campaignId = await page.locator('#campaign').inputValue();
  const invited = await page.request.post(`/api/campaigns/${campaignId}/invite`, {
    data: { email: 'player@aar.local' },
  });
  expect(invited.ok()).toBeTruthy();
  const { token } = await invited.json();
  await page.getByRole('button', { name: 'New session' }).click();
  await page.getByLabel('Session title').fill('The chamber of embers');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const initialSnapshot = await (await page.request.get(`/api/campaigns/${campaignId}`)).json();
  const privateNote = await page.request.post(`/api/campaigns/${campaignId}/evidence`, {
    data: {
      sessionId: initialSnapshot.sessions[0].id,
      speaker: 'DM',
      visibility: 'DM',
      content: 'The patron is secretly the royal archivist.',
    },
  });
  expect(privateNote.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  const pdf = await PDFDocument.create();
  const p = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  p.drawText('AAR character sheet', { x: 40, y: 700, font });
  const field = pdf.getForm().createTextField('CharacterName');
  field.setText('Fixture Hero');
  field.addToPage(p, { x: 40, y: 650, width: 200, height: 30 });
  await page.locator('input[type=file]').setInputFiles({
    name: 'character.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await pdf.save({ useObjectStreams: false })),
  });
  await expect(page.getByRole('heading', { name: 'Review extracted sheet' })).toBeVisible();
  await page.getByRole('button', { name: 'Review character proposal' }).click();
  await page.getByLabel('Class / identity').fill('Sorcerer 5');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.getByRole('button', { name: 'Load synthetic demo' }).click();
  await expect(
    page.getByText('Synthetic fixture processed. Review proposals before publishing.'),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Review queue/ }).click();
  await expect(page.locator('.proposal input[type=checkbox]')).toHaveCount(4);
  for (const checkbox of await page.locator('.proposal input[type=checkbox]').all())
    await checkbox.check();
  await page.getByRole('button', { name: 'Approve selected (4)' }).click();
  await expect(page.getByRole('status')).toContainText('approved atomically');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Publish approved facts' }).click();
  await expect(page.getByText('New party-safe report revision published in-app')).toBeVisible();
  await expect(page.locator('.report-entry')).toHaveCount(3);
  await expect(page.locator('.report')).not.toContainText('royal archivist');
  await page.screenshot({ path: 'test-results/aar-desktop.png', fullPage: true });
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const player = await pc.newPage();
  await player.goto('/');
  await player.getByLabel('Email address').fill('player@aar.local');
  await player.getByLabel('Password', { exact: true }).fill('Adventure!2026');
  await player.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(
    player.getByRole('heading', { name: 'Your next chapter starts here.' }),
  ).toBeVisible();
  const accepted = await player.request.post('/api/invitations', { data: { token } });
  expect(accepted.ok()).toBeTruthy();
  await player.reload();
  await player.getByRole('button', { name: 'Toggle navigation' }).click();
  await player.locator('#campaign').selectOption(campaignId);
  await player.getByRole('button', { name: 'Reports', exact: true }).click();
  await player.getByRole('button', { name: 'Flag this / suggest correction' }).first().click();
  await player
    .getByLabel('Suggested correction')
    .fill('The champion renounced his patron in the fiery chamber.');
  await player
    .getByLabel('Reason', { exact: true })
    .fill('Please clarify the wording with our table.');
  await player.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(player.getByRole('status')).toContainText('Saved');
  await page.getByRole('button', { name: /^Review queue/ }).click();
  await page.reload();
  await page.locator('#campaign').selectOption(campaignId);
  await page.getByRole('button', { name: /^Review queue/ }).click();
  await page.getByRole('button', { name: 'Edit / decide' }).first().click();
  await page
    .getByLabel('Accepted wording')
    .fill('The champion renounced his patron in the fiery chamber.');
  await page.getByLabel('Response visible to submitter').fill('Thanks — clarified.');
  await page
    .getByLabel('Private GM rationale')
    .fill('Private fixture rationale: never show to players.');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Publish approved facts' }).click();
  await expect(page.getByText('Amended after publication')).toBeVisible();
  await player.reload();
  await player.getByRole('button', { name: 'Toggle navigation' }).click();
  await player.locator('#campaign').selectOption(campaignId);
  await player.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(player.getByText('Amended after publication')).toBeVisible();
  await expect(player.locator('body')).not.toContainText('Private fixture rationale');
  await expect(player.locator('.report')).toContainText(
    'The champion renounced his patron in the fiery chamber.',
  );
  await player.getByRole('button', { name: 'Toggle navigation' }).click();
  await player.getByRole('button', { name: 'Ask AAR', exact: true }).click();
  await player.getByLabel('Your question').fill('Who is the royal archivist patron?');
  await player.getByRole('button', { name: 'Ask AAR', exact: true }).last().click();
  await expect(player.locator('.answer')).toContainText("I don't know");
  await player.screenshot({ path: 'test-results/aar-mobile.png', fullPage: true });
  await dm.close();
  await pc.close();
});
