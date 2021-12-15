import minimist from 'minimist';
import commander from 'commander';

// 获取未声明的命令行传递的参数
export default (declaredOptions: commander.Option[]) => {
  const argv = minimist(process.argv.slice(2));

  // 获取声明的 options 的参数 -a 和 --all 作为黑名单
  const declaredOptionsStrings = declaredOptions.reduce((list: string[], option) => {
    const { short = '', long = '' } = option;
    list.push(short.slice(1));
    list.push(long.slice(2));
    return list;
  }, []);

  return Object.keys(argv).reduce((unexpectedOptions: { [key: string]: any }, key) => {
    if (key !== '_' && !declaredOptionsStrings.includes(key)) {
      return {
        ...unexpectedOptions,
        [key]: argv[key],
      };
    }

    return unexpectedOptions;
  }, {});
};
