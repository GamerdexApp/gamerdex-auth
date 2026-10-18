describe('api/github/[action]', () => {
  it('exports the POST and OPTIONS handlers', async () => {
    jest.resetModules();
    process.env.GITHUB_CLIENT_SECRET = 's';
    process.env.ALLOWED_ORIGINS = 'https://tracker.test';
    const route = require('../api/github/[action]') as typeof import('../api/github/[action].js');
    expect(route.POST).toBe(route.OPTIONS);
    const response = await route.OPTIONS(
      new Request('https://auth.test/api/github/token', {
        method: 'OPTIONS',
        headers: { Origin: 'https://tracker.test' },
      }),
    );
    expect(response.status).toBe(204);
  });

  it('exports the POST and OPTIONS handlers of the Google route', async () => {
    jest.resetModules();
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 's';
    process.env.ALLOWED_ORIGINS = 'https://tracker.test';
    const route = require('../api/google/[action]') as typeof import('../api/google/[action].js');
    expect(route.POST).toBe(route.OPTIONS);
    const response = await route.OPTIONS(
      new Request('https://auth.test/api/google/token', {
        method: 'OPTIONS',
        headers: { Origin: 'https://tracker.test' },
      }),
    );
    expect(response.status).toBe(204);
  });
});
