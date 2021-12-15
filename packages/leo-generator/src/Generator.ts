import merge from 'lodash.merge';
import get from 'lodash.get';
import fs from 'fs-extra';
import Metalsmith from 'metalsmith';
import inquirer from 'inquirer';
import match from 'minimatch';
import consolidate from 'consolidate';
import Handlebars from 'handlebars';
import multimatch from 'multimatch';
import simpleGit from 'simple-git';
import { log as leoLog } from '@jdfed/leo-utils';
import { IFiles, IMetaData, IFilterFilesMap, IHelper } from './interface';

const log = leoLog.scope('generator');

// 这个库没有@types发布接口
const downloadGitRepo = require('download-git-repo');

type metalsmithCB = (files: IFiles, metalsmith: Metalsmith, done: Function) => void;
class Generator {
  // 虚拟目录路径，在linux中一般都是 ~/.leo/templates
  cachePath: string;
  // ~/.leo/templates/${templateName}
  localTemplatePath: string;
  // 远程模板地址
  repoRemoteAddress: string;
  // 当前虚拟目录模板下的template文件夹
  currentTemplatePath: string;
  // 当前虚拟目录模板下的meta.js
  currentMetaPath: string;

  templateName: string;

  projectName: string;
  projectPath: string;

  answer: Record<string, any>;
  officialEnv: Record<string, any>;

  metalsmith: Metalsmith;

  // 默认编译文件
  defaultCompileFiles: string[];

  leoRC: { [key: string]: any };
  leoConfig: { [key: string]: any };
  metaConfig: { [key: string]: any };

  hooks: {
    // 返回true表示接管构建任务，不再执行原有逻辑。发生在下载模板完成后。
    beforeGenerate: (generator: Generator) => Promise<boolean>;
    afterGenerate: (generator: Generator) => Promise<void>;
    /**
     * 参考项目https://github.com/segmentio/metalsmith
     * 以及@types/metalsmith
     * 渲染占位符时的hook，如果实现讲自己接管渲染占位符
     */
    renderTemplatePlaceholder: (
      generator: Generator,
    ) => (files: IFiles, metalsmith: Metalsmith, done: Function) => void;
    /**
     * 最终渲染文件的hook，理论上可以做任何事包括渲染占位符
     */
    renderTemplateFile: (
      generator: Generator,
    ) => (files: IFiles, metalsmith: Metalsmith, done: Function) => void;
  } = {
    beforeGenerate: null,
    afterGenerate: null,
    renderTemplatePlaceholder: null,
    renderTemplateFile: null,
  };

  options: {
    useCache: false;
    repo: '';
  };

  constructor(params: {
    templateName: string;
    projectName: string;
    leoConfig: { [key: string]: any };
    options: { [key: string]: any };
    cachePath: string; // 缓存文件存放的路径
  }) {
    this.templateName = params.templateName;
    this.projectName = params.projectName;
    this.cachePath = params.cachePath;
    this.leoConfig = params.leoConfig;

    // 模版的git地址
    this.repoRemoteAddress = `${this.leoConfig.gitTemplateGroupURL}/${this.templateName}-template.git`;
    // 本地模版的地址
    this.localTemplatePath = `${this.cachePath}/${this.templateName}-template`;

    this.currentTemplatePath = `${this.localTemplatePath}/template`;

    this.currentMetaPath = `${this.localTemplatePath}/meta.js`;

    this.defaultCompileFiles = ['package.json', this.leoConfig.rcFileName]; // 默认是 leorc.js

    this.answer = {};

    this.officialEnv = {};

    this.metalsmith = null;

    // 合并命令行设置的参数
    this.options = merge({}, this.options, params.options);
  }

  async start() {
    try {
      await this.prepare();

      this.answer = await this.askQuestions(get(this.metaConfig, 'prompts', []));
      this.officialEnv = await this.getGeneratorEnv();

      // 若beforeGenerate为true直接return，相当于模版方自己接管
      if (this.hooks.beforeGenerate && (await this.hooks.beforeGenerate(this)) === true) {
        return;
      }

      await this.generate();
      await this.initGitRepo(this.options.repo);

      // 构建结束之后执行afterGenerate
      this.hooks.afterGenerate && (await this.hooks.afterGenerate(this));
    } catch (e) {
      log.error('generator', (e as Error).message);
      process.exit(1);
    }
  }

  async getGeneratorEnv(): Promise<{ [key: string]: any }> {
    // 官方系统环境变量
    return {
      $projectName: this.projectName,
    };
  }

  async prepare() {
    const isUseCache = await this.useLocalCacheTemplate();
    if (!isUseCache) {
      await this.downloadTemplate();
    }

    // 判断是否有template的文件夹
    const hasCurTemplateFolder = await fs.pathExists(this.currentTemplatePath);
    if (!hasCurTemplateFolder) {
      throw new Error('模版下不存在template目录');
    }

    const projectPath = `${process.cwd()}/${this.projectName}`;
    const currentHasProject = await fs.pathExists(projectPath);

    if (this.leoConfig.isDebugger) {
      log.debug('generator.start', 'projectPath:', projectPath);
    }

    if (currentHasProject) {
      throw new Error('当前目录下已存在相同目录名');
    }
    this.projectPath = projectPath;

    // 不再获取leorc，改为获取模版的 meta.js 的配置
    this.metaConfig = await this.getTemplateMetaConfig();
    // 从 meta.js 中获取配置的 hooks
    merge(this.hooks, get(this.metaConfig, 'hooks', {}));
  }

  async generate(): Promise<any> {
    this.metalsmith = Metalsmith(this.currentTemplatePath);
    // 获取并注册用户的自定义handlebars的helper函数
    const customHelpers = get(this.metaConfig, 'helpers', {});
    if (Object.keys(customHelpers).length > 0) {
      this.registerCustomHelper(customHelpers);
    }

    Object.assign(this.metalsmith.metadata(), this.officialEnv, this.answer, customHelpers);

    const filterFilesMap = get(this.metaConfig, 'filterFilesMap', null);

    if (filterFilesMap) {
      this.metalsmith = this.metalsmith.use(this.filterFiles(filterFilesMap)); // 删除文件
    }

    const compileWhiteList = get(this.metaConfig, 'compileWhiteList', null);

    let renderTemplatePlaceholder = this.renderTemplatePlaceholder(compileWhiteList);

    if (this.hooks.renderTemplatePlaceholder) {
      renderTemplatePlaceholder = this.hooks.renderTemplatePlaceholder(this);
    }
    this.metalsmith = this.metalsmith.use(renderTemplatePlaceholder); // 渲染占位符

    if (this.hooks.renderTemplateFile) {
      this.metalsmith = this.metalsmith.use(this.hooks.renderTemplateFile(this));
    }

    return new Promise((resolve, reject) => {
      this.metalsmith
        .source('.')
        .destination(this.projectPath)
        .clean(false)
        .build(async (err: Error) => {
          if (err) {
            reject(err);
            return;
          }
          log.success('Generator构建完成');
          resolve(0);
        });
    });
  }

  /**
   * 询问用户
   * @params prompts
   * @return {Promise} 保存用户回答的答案
   */
  async askQuestions(prompts: any[]): Promise<{ [key: string]: any }> {
    return inquirer.prompt(prompts);
  }

  /**
   * 根据用户的回答的结果过滤相关文件
   * @params {IFilterFilesMap} filterFilesMap
   * @return {metalsmithCB} 执行done()回调表示执行完毕
   */
  filterFiles(filterFilesMap: IFilterFilesMap): metalsmithCB {
    /* eslint no-param-reassign: "error" */

    return (files: IFiles, metalsmith: Metalsmith, done: Function) => {
      // 如果不需要过滤文件直接终止
      if (!filterFilesMap) {
        return done();
      }

      const metaData: IMetaData = metalsmith.metadata();
      const fileNameList = Object.keys(files);
      const filtersList = Object.keys(filterFilesMap);
      if (this.leoConfig.isDebugger) {
        log.debug('generator.filterFiles.before', Object.keys(files));
      }
      // 根据用户所选择的配置所对应的文件名或文件夹名进行匹配
      filtersList.forEach((filter) => {
        fileNameList.forEach((filename) => {
          // 匹配filtersList里面需要过滤的文件，(文件夹及文件的匹配需要通过minimatch库进行匹配，无法直接通过数组的方法直接匹配)
          // 例如src/router/**/*/代表匹配router下所有文件
          // dot为true表示可以匹配.开头的文件，例如.eslintrc.js等
          if (match(filename, filter, { dot: true })) {
            const conditionKey = filterFilesMap[filter];
            // 对用户不需要的配置的文件进行删除处理
            if (!metaData[conditionKey]) {
              delete files[filename];
            }
          }
        });
      });
      if (this.leoConfig.isDebugger) {
        log.debug('generator.filterFiles.after', Object.keys(files));
      }
      // 终止回掉
      done();
    };
  }

  /**
   * 渲染template文件, 若有renderTemplatePlaceholder钩子函数则不执行官方的渲染
   * @return {metalsmithCB} 执行done()回调表示执行完毕
   */
  renderTemplatePlaceholder(compileWhiteList: string[] | null): metalsmithCB {
    /* eslint no-param-reassign: "error" */

    return (files: IFiles, metalsmith: Metalsmith, done: Function) => {
      const keys = Object.keys(files);
      const metalsmithMetadata = metalsmith.metadata();
      // 判断模版是否有白名单
      const hasWhiteList = this.existCompileWhiteList(compileWhiteList);
      // 循环查询有模版语法的的文件，替换相关handlebars语法的地方，然后生成新的文件
      keys.forEach((fileName) => {
        const str = files[fileName].contents.toString();
        const shouldCompileFile =
          this.isDefaultCompileFile(fileName) ||
          this.matchCompileFile(hasWhiteList, fileName, compileWhiteList);
        // 匹配有handlebars语法的文件
        if (shouldCompileFile && /{{([^{}]+)}}/g.test(str)) {
          consolidate.handlebars.render(str, metalsmithMetadata, (err: Error, res: string) => {
            if (err) {
              throw new Error(`模版文件${fileName}渲染出现异常`);
            }
            files[fileName].contents = Buffer.from(res);
          });
        }
      });
      done();
    };
  }

  /**
   * 初始化 git 并关联远程仓库（如传入仓库地址）
   * @params
   * @return {Promise<any>}
   */
  async initGitRepo(repo: string): Promise<any> {
    if (!repo) {
      return;
    }
    const git = simpleGit(this.projectPath);

    log.await(`正在关联远程仓库：${repo}`);
    await git.init();
    await git.addRemote('origin', repo);
    await git.add(['.']);
    await git.commit(`leo init from ${this.templateName}-template`);
    await git.push('origin', 'master', ['--set-upstream']);
    log.success('关联成功');
  }

  /**
   * 判断是否使用缓存模版，若使用需判断是否存在，不存在则抛出异常
   * @params
   * @return {Promise<boolean>}
   */
  private async useLocalCacheTemplate(): Promise<boolean> {
    if (!this.options.useCache) {
      return false;
    }
    const templatePath = `${this.localTemplatePath}`;
    const hasTemplatePath = await fs.pathExists(templatePath);
    if (!hasTemplatePath) {
      throw new Error(`${templatePath} 不存在，无法使用缓存模版`);
    } else {
      return true;
    }
  }

  /**
   * 下载远程模板
   * @return {Promise}
   */
  private async downloadTemplate(): Promise<void> {
    log.await('generator', `下载远程模板: ${this.templateName}-template`);
    const gitPath = this.repoRemoteAddress;
    const target = this.localTemplatePath;

    if (this.leoConfig.isDebugger) {
      log.debug('generator.downloadTemplate', `gitPath:${gitPath} target:${target}`);
    }

    // 删除本地缓存文件后创建一个新的空文件
    await fs.remove(target);
    await fs.ensureDir(target);

    // 下载仓库中的模板至缓存文件夹
    return new Promise((resolve, reject) => {
      downloadGitRepo(
        `direct:${gitPath}`,
        target,
        { clone: true, headers: this.leoConfig.gitTemplateLikeQueryHeader || {} },
        (err: Error) => {
          if (err) {
            return reject(new Error(`下载模板错误：${err}`));
          }
          log.success('generator', '模板下载成功');
          return resolve();
        },
      );
    });
  }

  /**
   * 获取模版的 meta.js 文件
   * @return Promise<null | Object> meta.js的值
   */
  private async getTemplateMetaConfig(): Promise<null | Object> {
    const templateMetaPath = `${this.localTemplatePath}/meta.js`;
    const templatePackagePath = `${this.localTemplatePath}/package.json`;
    const hasMeta = await fs.pathExists(templateMetaPath);
    const hasPackage = await fs.pathExists(templatePackagePath);
    if (hasPackage) {
      log.await('====安装template的依赖====');
      await this.installTemplatePkg();
    }
    if (hasMeta) {
      const metaConfig = require(templateMetaPath);
      if (this.leoConfig.isDebugger) {
        log.debug('generator.getTemplateMetaConfig', JSON.stringify(metaConfig));
      }
      return metaConfig;
    }

    return null;
  }

  /**
   * 判断metaConfig是否存在编译白名单
   * @return {boolean}
   */
  private existCompileWhiteList(compileWhiteList: string[] | null): boolean {
    return !!compileWhiteList && Array.isArray(compileWhiteList) && compileWhiteList.length > 0;
  }

  /**
   * 判断当前文件是否需要编译
   * @return {boolean}
   */
  private matchCompileFile(
    hasWhiteList: boolean,
    fileName: string,
    compileWhiteList: string[] | null,
  ): boolean {
    return (
      !hasWhiteList ||
      (hasWhiteList && multimatch([fileName], compileWhiteList, { dot: true }).length > 0)
    );
  }

  /**
   * 默认自动编译的文件
   * @return {boolean}
   */
  private isDefaultCompileFile(fileName: string): boolean {
    return this.defaultCompileFiles.indexOf(fileName) >= 0;
  }
  /**
   * 自动安装模版需要的package.json
   * @return {Promise<void>}
   */
  private async installTemplatePkg(): Promise<void> {
    const npmi = require('npminstall');
    try {
      await npmi({
        production: true,
        root: this.localTemplatePath,
        registry: 'http://registry.m.jd.com/',
      });
    } catch (e) {
      log.warn('template依赖包安装存在问题', e);
    }
    log.success('installTemplatePkg', '安装成功');
  }

  /**
   * 注册用户自定义handlebars的helper函数
   * https://handlebarsjs.com/api-reference/runtime.html#handlebars-registerhelper-name-helper
   * @return {void}
   */
  private registerCustomHelper(helpers: IHelper): void {
    Object.keys(helpers).forEach((key: string) => {
      Handlebars.registerHelper(key, helpers[key]);
    });
  }
}

export default Generator;
