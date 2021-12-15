import spawn from 'cross-spawn';

// 通过npm info获取包的版本信息
export default (projectName: string): Promise<{ latest: string; [tag: string]: string }> => {
  return new Promise((resolve) => {
    const pkgInfoStr = spawn.sync('npm', ['info', projectName, '--json']).stdout.toString();

    const pkgInfo = JSON.parse(pkgInfoStr);

    resolve(pkgInfo['dist-tags']);
  });
};
