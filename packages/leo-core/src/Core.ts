import {
  getLeoRC,
  getCorePackageJSON,
  getProjectPackageJSON,
  runInstall,
  extendsProcessEnv,
  getRemotePkgTagVersion,
} from './utils';
import { IRC } from './defaultRC';
import fs from 'fs-extra';
import semver from 'semver';
import set from 'lodash.set';
import unset from 'lodash.unset';
import merge from 'lodash.merge';
import simpleGit from 'simple-git';
import inquirer from 'inquirer';
import axios from 'axios';
import { loadPkg, log as leoLog } from '@jdfed/leo-utils';
import { getDefaultConfig, IConfig, IActionArgs, localStaticConfig, configStore } from './config';
import { IBuilder, IVirtualPath, ICommonParams, ILeoCaller } from './interface';

export interface IHooks {
  beforeStart?: (this: Core) => any;
  afterCommandExecute?: (this: Core) => any;
}

const log = leoLog.scope('core');

class Core {
  leoRC: IRC;
  leoConfig: IConfig;
  cli: ILeoCaller = null;
  generator: ILeoCaller = null;
  builder: IBuilder = null;
  rootName: string;
  hooks: IHooks = {};
  virtualPath: IVirtualPath;
  constructor({ config, hooks = {} }: { config?: IConfig; hooks?: IHooks } = {}) {
    this.hooks = hooks;

    this.leoConfig = configStore.init(getDefaultConfig(config)).getConfig() as IConfig;

    // 初始化一些环境变量供leo-utils使用
    extendsProcessEnv(this.leoConfig);
    // 初始化本地 config
    this.initLocalConfig();
  }

  async start() {
    try {
      this?.hooks?.beforeStart?.call(this);
      this.leoRC = getLeoRC(this.leoConfig.rcFileName);

      log.debug(`${this.leoConfig.rcFileName}`, JSON.stringify(this.leoRC, null, 2));
      log.debug('config', JSON.stringify(this.leoConfig, null, 2));

      await this.initCLI();

      await this.cli.start();
    } catch (e) {
      log.error(this.leoConfig.isDev ? e : ((e as unknown) as Error)?.message);
      process.exit(-1);
    }
  }

  cliActionHandler = async (
    command: string,
    args: IActionArgs,
    extendsCommandAction?: (params: {
      args: IActionArgs;
      subCommandName: string;
      [key: string]: any;
    }) => void,
  ) => {
    log.debug('cliActionHandler', 'commandName:', command, 'args:', args);

    try {
      const [commandName, subCommandName] = command.split('.');

      await this.doStartCheck();

      // 约定必须要实现的
      switch (commandName) {
        case 'init':
          await this.commandInitAction(args);
          break;
        case 'dev':
          await this.commandDevAction(args);
          break;
        case 'build':
          await this.commandBuildAction(args);
          break;
        case 'test':
          await this.commandTestAction(args);
          break;
        case 'lint':
          await this.commandLintAction(args);
          break;
        case 'clear':
          await this.commandClearAction(args);
          break;
        case 'config':
          await this.commandConfigAction(subCommandName, args);
          break;
        default:
          await this.extendsCommandAction(commandName, subCommandName, args, extendsCommandAction);
          break;
      }

      this?.hooks?.afterCommandExecute?.call(this);
    } catch (error) {
      log.error(this.leoConfig.isDev ? error : ((error as unknown) as Error)?.message);
      process.exit(-1);
    }
  };

  // 以下命令回调
  // init 指令回调
  async commandInitAction(args: IActionArgs) {
    let {
      arguments: [templateName],
    } = args;
    const { options, unexpectedOptions } = args;

    // 模糊查询需要登录，如果直接使用如 leo init ifloor，也会提示，所以设置了配置项控制
    if (templateName) {
      const projectList = await this.getProjectsLikeName(templateName);

      if (projectList.length <= 0) {
        throw new Error(`未找到对应的模板，请校对模板名是否正确(${templateName})`);
      }

      // 当模板为 aa-bb 时，输出 leo init aa，也应当有提示
      if (
        (projectList.length === 1 && projectList[0].value !== templateName) ||
        projectList.length > 1
      ) {
        log.info('如需关闭模板模糊查询功能，可使用 leo config set fuzzyTemp=false');
        const res = await this.askQuestions([
          {
            name: 'templateName',
            type: 'list',
            message: `查询到与 ${templateName} 相关的模板，请选择：`,
            choices: projectList,
          },
        ]);
        templateName = res.templateName;
      }
    }

    if (!templateName) {
      const res = await this.askQuestions(this.leoConfig.questions.chooseTemplate);
      templateName = res.templateName;
    }

    const { useInstall, projectName } = await this.askQuestions(this.leoConfig.questions.init);

    log.debug('commandInitAction', templateName, options);

    log.info('开始创建项目');

    await this.initGenerator(templateName, { ...options, ...unexpectedOptions }, projectName);

    if (useInstall !== 'custom') {
      log.await('开始安装依赖');
      await runInstall(useInstall === 'yarn', projectName);
      log.success('安装完成！');
    }

    log.info(
      `初始化成功！\n 使用以下指令来开始项目:\n cd ${projectName}\n ${this.leoConfig.rootName} dev\n`,
    );

    this.leoConfig.helpTexts.forEach((helpInfo) => {
      log.info(helpInfo.text);
    });
  }

  async commandDevAction(args: IActionArgs) {
    log.debug('commandDevAction', args);

    const { options, unexpectedOptions } = args;

    log.info('启动调试');

    await this.initBuilder({ ...options, ...unexpectedOptions });

    //  hook: beforeDev
    await this.leoRC?.builder?.hooks?.beforeDev?.(this.builder);

    await this.builder.start();

    //  hook: afterDev
    await this.leoRC?.builder?.hooks?.afterDev?.(this.builder);
  }

  async commandBuildAction(args: IActionArgs) {
    log.debug('commandBuildAction', args);

    const { options, unexpectedOptions } = args;
    log.info('开始构建');

    await this.initBuilder({ ...options, ...unexpectedOptions });

    // hook: beforeBuild
    await this.leoRC?.builder?.hooks?.beforeBuild?.(this.builder);

    await this.builder.build();

    // hook: beforeBuild
    await this.leoRC?.builder?.hooks?.afterBuild?.(this.builder);
  }

  async commandTestAction(args: IActionArgs) {
    log.debug('commandTestAction', args);

    const { options, unexpectedOptions } = args;
    log.info('开始测试');

    return await this.doTestAction({ ...options, ...unexpectedOptions });
  }

  async doTestAction(options: { [key: string]: any } = {}) {
    if (this.leoRC.testAction) {
      // 外部传入优先级更高
      const testRes = await this.leoRC.testAction(options);
      if (testRes !== true) {
        throw new Error('test 失败');
      }
      return testRes;
    } else {
      log.warn('未找到 leorc 中 testAction 配置');
    }
    // true 为正常执行
    return true;
  }

  async commandLintAction(args: IActionArgs) {
    log.debug('commandLintAction', args);

    const { options, unexpectedOptions } = args;
    log.info('开始Lint');

    return await this.doLintAction({ ...options, ...unexpectedOptions });
  }

  async doLintAction(options: { [key: string]: any } = {}) {
    if (this.leoRC.lintAction) {
      // 外部传入优先级更高
      const lintRes = await this.leoRC.lintAction(options);
      // 由于 leorc 是 js 编写，必须强制校验 lintAction 的返回，
      // 同理 test action 也添加相同逻辑
      if (lintRes !== true) {
        throw new Error('lint 失败');
      }
      return lintRes;
    } else {
      log.warn('未找到 leorc 中 lintAction 配置');
    }
    // true 为正常执行
    return true;
  }

  async commandClearAction(args: IActionArgs) {
    const { options } = args;
    log.info('开始清理');

    // 如果未填参数则显示帮助信息
    if (Object.values(options).every((v) => v === false)) {
      return this.doClearAction();
    }

    await Promise.all(
      Object.entries(options)
        .filter((keyValue) => keyValue[1] === true)
        .map((keyValue) => this.doClearAction(keyValue[0])),
    );
  }

  async prePublishAction(args: IActionArgs) {
    log.debug('prePublishAction', this.leoRC.isPrePublishParallel);

    if (this.leoRC.isPrePublishParallel) {
      return Promise.all([
        this.commandLintAction(args),
        this.commandTestAction(args),
        this.commandBuildAction(args),
      ]);
    }
    const lintResult = await this.commandLintAction(args);
    if (lintResult !== true) return;
    const testResult = await this.commandTestAction(args);
    if (testResult !== true) return;
    await this.commandBuildAction(args);
  }

  async doClearAction(clearName?: string) {
    const { virtualPath } = this.leoConfig;

    switch (clearName) {
      case 'config':
        await fs.remove(virtualPath.configPath);
        log.success('清除 leoConfig 缓存成功');
        break;
      case 'template':
        await fs.remove(virtualPath.templatePath);
        log.success('清除模板缓存成功');
        break;
      case 'node_modules':
        await fs.remove(virtualPath.nodeModulesPath);
        log.success('清除 npm 包缓存成功');
        break;
      case 'all':
      default:
        await fs.remove(virtualPath.entry);
        log.success('清除所有缓存成功');
    }
  }

  async commandConfigAction(subCommandName: string, args: IActionArgs) {
    // 确保 config 文件存在
    const {
      virtualPath: { configPath },
    } = this.leoConfig;
    await fs.ensureFile(configPath);
    const localConfig = (await fs.readJson(configPath)) || {};
    const {
      arguments: [key],
    } = args;

    switch (subCommandName) {
      case 'set':
        await this.doSetConfigAction(args, localConfig);
        break;
      case 'get':
        log.info(localConfig[key]);
        break;
      case 'delete':
        unset(localConfig, key);
        await fs.writeJson(this.leoConfig.virtualPath.configPath, localConfig);
        log.success('删除成功');
        break;
      case 'list':
        log.info(localConfig);
        break;
      default:
        // 不存在无值的情况，未传指令commander会拦截
        break;
    }
  }

  async doSetConfigAction(args: IActionArgs, localConfig: { [key: string]: any }) {
    // args.arguments 为 ['key=value','key=value'] 格式
    const keyValueMap = args.arguments.reduce((map, keyValue) => {
      // 命令行空格会出现 undefined
      if (keyValue) {
        const [key, value] = keyValue.split('=');
        const v = value === 'true' || value === 'false' ? value === 'true' : value;
        set(map, key, v);
      }
      return map;
    }, {});

    await fs.writeJson(this.leoConfig.virtualPath.configPath, merge({}, localConfig, keyValueMap));

    log.success('设置成功');
  }

  async extendsCommandAction(
    commandName: string,
    subCommandName: string,
    args: IActionArgs,
    extendsCommandAction: (params: {
      args: IActionArgs;
      subCommandName: string;
      [key: string]: any;
    }) => void,
  ) {
    await extendsCommandAction?.({
      args,
      subCommandName,
      ...this.getCommonParams(),
    });
  }

  askQuestions(questions: any[]): Promise<{ [key: string]: any }> {
    return inquirer.prompt(questions);
  }

  /**
   * 执行检查
   * @returns {Promise}
   */
  async doStartCheck(): Promise<any> {
    // 云构建某些情况无法连接内网
    const checkList = [this.checkNodeVersion(), this.checkVersion()];

    return Promise.all(checkList);
  }

  private async initBuilder(options: { [key: string]: any } = {}): Promise<void> {
    log.debug('initBuilder', 'before builder create');

    const { leoRC } = this;
    const Builder = (await loadPkg(leoRC.builder.name, {
      version: leoRC.builder.version,
      private: true,
    })) as any;

    this.builder = new Builder({
      options,
      ...this.getCommonParams(),
    });
  }

  private async initCLI(): Promise<void> {
    log.debug('initCLI', 'before CLI create');

    const { leoConfig } = this;
    const { version } = getCorePackageJSON();

    const CLI = (await loadPkg(leoConfig.cli.name, leoConfig.cli.version)) as any;

    this.cli = new CLI({
      commands: this.leoConfig.commands,
      actionHandler: this.cliActionHandler,
      version,
      helpTexts: this.leoConfig.helpTexts,
      ...this.getCommonParams(),
    });
  }

  private async initGenerator(
    templateName: string,
    options: { [key: string]: any },
    projectName: string,
  ): Promise<void> {
    log.debug('initGenerator', 'start init generator');

    const { leoConfig } = this;
    const Generator = (await loadPkg(leoConfig.generator.name, leoConfig.generator.version)) as any;

    this.generator = new Generator({
      templateName,
      projectName,
      options,
      cachePath: this.leoConfig.virtualPath.templatePath,
      ...this.getCommonParams(),
    });

    await this.generator.start();
  }

  /**
   * 检查node版本
   * @private
   * @returns {Promise}
   */
  private checkNodeVersion(): Promise<any> {
    // 检查 node 版本
    const { engines } = getCorePackageJSON();
    const nodeVersionSatisfy = semver.satisfies(process.version, engines.node);
    if (nodeVersionSatisfy) return Promise.resolve(0);
    return Promise.reject(new Error(`请使用${engines.node}版本的 node`));
  }

  /**
   * 检查当前版本与最新版本是否一致并提示
   * @private
   * @returns {Promise}
   */
  private async checkVersion(): Promise<any> {
    // 默认提示升级，如开启强制升级，则中断后续操作
    const pkg = getCorePackageJSON();
    const pkgTagVersion = await getRemotePkgTagVersion(pkg.name);

    const { latest } = pkgTagVersion;

    // 检查正式版本
    if (semver.gt(latest, pkg.version) && this.leoConfig.forceUpdate) {
      return Promise.reject(new Error('当前版本过旧，请升级后使用'));
    }
  }

  private async checkPublishStatus(): Promise<string> {
    const git = simpleGit();

    // 检查 git 是否全部提交
    // 检查当前登录状态（是否过期）
    const [{ files }] = await Promise.all([git.status()]);

    if (files.length) {
      return 'git 全部提交后才能进行发布';
    }
    return '';
  }

  /**
   * @description 模糊查询leo-templates下的模板
   * @private
   * @memberof Core
   */
  private getProjectsLikeName = async (name: string): Promise<[{ [key: string]: any }]> => {
    const { data: templateList } = await axios
      .get(`${this.leoConfig.gitTemplateGroupQueryURL}`, {
        headers: this.leoConfig.gitQueryHeader,
      })
      .catch(() => {
        return { data: [] };
      });

    return templateList
      .map((item: { [key: string]: any }) => {
        const templateName = item.path.replace(/-template$/, '');
        return {
          name: `${templateName}(${item.name})`,
          value: templateName,
        };
      })
      .filter((item: { [key: string]: any }) => {
        return this.leoConfig.fuzzyTemp ? item.value.indexOf(name) !== -1 : item.value === name;
      })
      .sort((item: { [key: string]: any }) => (item.value === name ? -1 : 0));
  };

  /**
   * @description 初始化本地 config，如果本地不存在，则创建
   * @private
   * @memberof Core
   */
  private initLocalConfig = () => {
    const {
      virtualPath: { configPath },
    } = this.leoConfig;

    if (fs.existsSync(configPath)) {
      return;
    }
    fs.outputJsonSync(configPath, localStaticConfig);
  };

  /**
   * @description 提供需要为插件提供的公共参数
   * @private
   */
  private getCommonParams(): ICommonParams {
    return {
      leoConfig: this.leoConfig,
      leoRC: this.leoRC,
      leoUtils: {},
      pkg: getProjectPackageJSON(),
    };
  }
}

export default Core;
