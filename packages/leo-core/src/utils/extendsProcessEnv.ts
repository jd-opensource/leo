import { IConfig } from '../config';
import get from 'lodash.get';

// 设置环境变量，仅供 leo-utils 使用
// 其他插件应当从实例化传参中获取相应数据
export default (config: IConfig) => {
  const env = {
    // loadPkg 的安装路径
    __NODEMODULEPATH: 'virtualPath.nodeModulesPath',
    // 是否使用 yarn
    __USEYARN: 'useYarn',
    // 是否 dev 模式
    __ISDEV: 'isDev',
    // 是否 debug 模式
    __ISDEBUG: 'isDebug',
    // __GITQUERYTOKEN: ['gitQueryHeader', 'Private-Token'],
  };

  Object.entries(env).forEach((item) => {
    const [key, path] = item;
    process.env[key] = get(config, path).toString();
  });
};
