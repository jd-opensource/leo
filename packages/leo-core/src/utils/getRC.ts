import path from 'path';
import fs from 'fs';
import merge from 'lodash.merge';
import defaultRC, { IRC } from '../defaultRC';

export default (rcFileName: string): IRC => {
  if (!fs.existsSync(path.resolve(process.cwd(), rcFileName))) {
    return defaultRC;
  }
  const localLeoRc = require(path.resolve(process.cwd(), rcFileName));

  return merge({}, defaultRC, localLeoRc);
};
