// Private subprocess fixture used by test/data-lease.test.js. Not packaged.
import { createServer } from '../src/server.js';
try {
  const { server } = await createServer({ root: process.argv[2], key: 'fixture-key-only-for-data-lease-tests' });
  server.listen(0, '127.0.0.1', () => process.send({ ready: true }));
  process.on('message', value => { if (value === 'stop') server.close(() => process.exit(0)); });
} catch (error) { process.send({ rejected: true, message: error.message }, () => process.exit(2)); }
