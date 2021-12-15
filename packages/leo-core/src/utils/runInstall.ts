import spawn from 'cross-spawn';
import path from 'path';

export default (isYarn: boolean, projectName: string) => {
  return new Promise((resolve) => {
    const executable = isYarn ? 'yarn' : 'npm';

    spawn.sync(executable, ['install'], {
      stdio: 'inherit',
      cwd: `${path.resolve(process.cwd(), projectName)}`,
    });
    resolve('');
  });
};
