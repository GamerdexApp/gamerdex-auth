import { createGoogleRoute } from '../../src/googleRoute';

const handle = createGoogleRoute(process.env);

export const POST = handle;
export const OPTIONS = handle;
