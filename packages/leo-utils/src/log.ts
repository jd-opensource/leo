import { Signale } from 'signale';
import { Writable } from 'stream';

const rewriteDebugTypes = <T extends { [key: string]: any }>(defaultTypes: T): T => {
  const writable = new Writable({
    write(chunk, encoding, callback): void {
      if (process.env.__ISDEBUG === 'true') {
        process.stdout.write(chunk);
      }
      process.nextTick(callback);
    },
  });

  return {
    ...defaultTypes,
    debug: Object.assign({}, defaultTypes.debug, {
      stream: writable,
    }),
  };
};

const defaultTypes = require('signale/types.js');

const costomTypes = rewriteDebugTypes(defaultTypes);

const log = new Signale({
  types: costomTypes,
});

export default log;
