import path from 'path';

export const getCorePackageJSON = () => {
  return require(path.resolve(__dirname, '../../package.json'));
};

export const getProjectPackageJSON = () => {
  // init config 等指令时，可能不存在 package.json
  try {
    return require(path.resolve(process.cwd(), './package.json'));
  } catch (e) {
    return undefined;
  }
};
