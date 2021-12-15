import { Question } from 'inquirer';
import { HelperDelegate } from 'handlebars';

export interface IPrompt extends Question {
  name: string; // 问题字段
  require?: boolean; // 是否为必填项
  choices?: []; // 对应的多选选项
}

export interface IMeta {
  prompts: IPrompt[];
  filterFilesMap?: IFilterFilesMap;
  helpers?: IHelper;
  hooks?: {
    beforeGenerate?: Function;
    afterGenerate?: Function;
  };
}

export interface IFilterFilesMap {
  [propName: string]: string;
}

export interface IMetaData {
  [propName: string]: any;
}

export interface IFiles {
  [propName: string]: any;
}

export interface IHelper {
  [propName: string]: HelperDelegate;
}

export default IMeta;
