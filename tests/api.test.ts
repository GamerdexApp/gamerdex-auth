describe('api/github/[action]', () => {
  it('exports the POST and OPTIONS handlers', async () => {
    jest.resetModules();
    process.env.GITHUB_CLIENT_SECRET = 's';
    process.env.ALLOWED_ORIGINS = 'https://tracker.test';
    const route = await import('../api/github/[action]');
    expect(route.POST).toBe(route.OPTIONS);
    const response = await route.OPTIONS(
      new Request('https://auth.test/api/github/token', {
        method: 'OPTIONS',
        headers: { Origin: 'https://tracker.test' },
      }),
    );
    expect(response.status).toBe(204);
  });
});
