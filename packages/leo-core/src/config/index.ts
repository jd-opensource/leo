// import merge from 'lodash.merge';
// import getConfig from './get-config';
// import defaultConfig, { defaultLocalConfig } from './config';
//
// import { IConfig } from './interface';
//
//
// // 深拷贝一份
// export const getDeepCopyConfig = (): IConfig => (merge({}, defaultConfig) as unknown) as IConfig;
// export { defaultLocalConfig };
//
// export default getConfig;
import configStore from './configStore';
import { localStaticConfig, staticConfig } from './staticConfig';
import getDefaultConfig from './getDefaultConfig';

export { localStaticConfig, staticConfig, getDefaultConfig, configStore };

export { IConfig, IActionArgs } from './interface';
