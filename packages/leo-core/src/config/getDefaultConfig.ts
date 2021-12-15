import home from 'user-home';
import merge from 'lodash.merge';
import { localStaticConfig, staticConfig } from './staticConfig';

import { IDynamicConfig, IConfig } from './interface';

export default (customConfig: { [key: string]: any }): IConfig => {
  const config = merge({}, localStaticConfig, staticConfig, customConfig);

  const rootPath = `${home}/.${config.rootName}`; // 通常为 /Users/username/.leo

  const dynamicConfig: IDynamicConfig = {
    virtualPath: {
      // 虚拟目录存储路径
      entry: rootPath,
      configPath: `${rootPath}/config.json`,
      templatePath: `${rootPath}/templates`,
      nodeModulesPath: `${rootPath}/${config.rootName}_modules`,
    },
  };

  return {
    ...config,
    ...dynamicConfig,
  };
};
