import { createGitHubRoute } from '../../src/githubRoute';

const handle = createGitHubRoute(process.env);

export const POST = handle;
export const OPTIONS = handle;
