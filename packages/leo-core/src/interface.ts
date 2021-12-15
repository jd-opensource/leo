import { IConfig } from './config';
import { IRC } from './defaultRC';

export interface ILeoCaller {
  start: () => Promise<any>;
  [key: string]: any;
}

export interface IBuilder extends ILeoCaller {
  build: () => Promise<any>;
}

export interface IVirtualPath {
  entry: string;
  configPath: string;
  templatePath: string;
  nodeModulesPath: string;
}

// 需要为插件提供的公共参数
export interface ICommonParams {
  leoConfig: IConfig;
  leoRC: IRC;
  leoUtils: {};
  pkg?: { [key: string]: any };
}
