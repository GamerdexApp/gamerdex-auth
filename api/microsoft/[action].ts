import { createMicrosoftRoute } from '../../src/microsoftRoute';

const handle = createMicrosoftRoute(process.env);

export const POST = handle;
export const OPTIONS = handle;
