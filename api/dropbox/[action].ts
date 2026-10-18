import { createDropboxRoute } from '../../src/dropboxRoute';

const handle = createDropboxRoute(process.env);

export const POST = handle;
export const OPTIONS = handle;
