import { test, expect } from '@playwright/test';
test('HTTP boundary blocks non-members, player approvals, CSRF and invalid PDF', async ({
  playwright,
  baseURL,
}) => {
  const dm = await playwright.request.newContext({ baseURL });
  const player = await playwright.request.newContext({ baseURL });
  const guest = await playwright.request.newContext({ baseURL });
  try {
    expect((await guest.get('/api/campaigns')).status()).toBe(401);
    expect(
      (
        await guest.post('/api/auth/login', {
          headers: { Origin: 'https://attacker.example.test' },
          data: { email: 'dm@aar.local', password: 'Adventure!2026' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await dm.post('/api/auth/login', {
          data: { email: 'dm@aar.local', password: 'Adventure!2026' },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (
        await player.post('/api/auth/login', {
          data: { email: 'player@aar.local', password: 'Adventure!2026' },
        })
      ).ok(),
    ).toBeTruthy();
    const cid = (
      await (await dm.post('/api/campaigns', { data: { name: 'Isolated HTTP boundary' } })).json()
    ).id;
    expect((await player.get(`/api/campaigns/${cid}`)).status()).toBe(403);
    expect((await player.post(`/api/campaigns/${cid}/proposals`, { data: {} })).status()).toBe(403);
    expect(
      (
        await player.post(`/api/campaigns/${cid}/extract-transcript`, {
          data: { sessionId: crypto.randomUUID(), visibility: 'DM' },
        })
      ).status(),
    ).toBe(403);
    const campaigns = await (await dm.get('/api/campaigns')).json();
    const shared = campaigns[0].id;
    expect(
      (
        await player.post(`/api/campaigns/${shared}/review`, {
          data: { ids: [crypto.randomUUID()], decision: 'APPROVED' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await player.post(`/api/campaigns/${shared}/extract-transcript`, {
          data: { sessionId: crypto.randomUUID(), visibility: 'PARTY' },
        })
      ).status(),
    ).toBe(403);
    const upload = await dm.post(`/api/campaigns/${cid}/import`, {
      multipart: {
        file: {
          name: '../../malicious.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('not a PDF'),
        },
      },
    });
    expect(upload.status()).toBe(400);
    expect((await upload.json()).error).toBe('Invalid PDF header');
    expect(
      (await player.get(`/api/campaigns/${cid}/download/${crypto.randomUUID()}`)).status(),
    ).toBe(403);
  } finally {
    await dm.dispose();
    await player.dispose();
    await guest.dispose();
  }
});
