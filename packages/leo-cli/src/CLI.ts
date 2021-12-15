import commander from 'commander';
import { ICommandSettingAlone, ICommandSettings, IActionArgs } from './interface';
import get from 'lodash.get';
import merge from 'lodash.merge';
import { log as leoLog, loadPkg } from '@leo/leo-utils';
import { getUnexpectedOptions, rebuildCommanderArgs } from './utils';

const log = leoLog.scope('cli');

type IActionHandler = (
  commandName: string,
  args: IActionArgs,
  extendsCommandAction?: (params: {
    args: IActionArgs;
    subCommandName: string;
    [key: string]: any;
  }) => void,
) => void | Promise<void>;

const commandFactory = (params: {
  program: commander.Command;
  name: string;
  setting: ICommandSettingAlone;
  actionCB: (commandName: string) => IActionHandler;
  // name 用于定义命令的名字，actionName 用于定义 action 回调中命令名的传参，默认使用 name（为了配合 publish.name）
  actionName?: string;
}) => {
  const { program, name, setting, actionCB, actionName } = params;
  const c = program.command(name);

  if (setting.arguments) {
    c.arguments(setting.arguments);
  }

  c.description(setting.cmdDesc, setting.argumentsDesc || {});

  // 允许添加任意参数而不报错，默认为 true
  if (setting.allowUnknownOption !== false) {
    c.allowUnknownOption();
  }

  setting.options &&
    setting.options.forEach((option) => {
      c.option(...option);
    });

  if (setting.helpTexts) {
    setting.helpTexts.forEach((helpInfo) => {
      c.addHelpText(helpInfo.position, helpInfo.text);
    });
  }

  // 如果有子命令，则不在当前命令上添加 action
  if (setting.subCommands) {
    Object.keys(setting.subCommands).forEach((subCommandName) => {
      commandFactory({
        program: c,
        name: subCommandName,
        setting: setting.subCommands[subCommandName],
        actionCB,
        actionName: `${name}.${subCommandName}`,
      });
    });

    return;
  }

  c.action(actionCB(actionName || name));
};

class CLI {
  commandSettings: ICommandSettings;
  program: commander.Command;
  leoConfig: { [key: string]: any };
  leoRC: { [key: string]: any };
  actionHandler: IActionHandler;
  // DOCUMENT
  hooks: {
    beforeEveryAction: (cli: CLI, commandName: string, args: any[]) => void | Promise<void>;
    /*
     * 如果返回 false 则会拦截后续行为，完全自己代理
     * 比如自己创建的命令，需要return true
     */
    shouldActionContinue: (
      cli: CLI,
      commandName: string,
      args: any[],
    ) => boolean | Promise<boolean>;
    afterEveryAction: (cli: CLI, commandName: string, args: any[]) => void;
  } = {
    beforeEveryAction: null,
    shouldActionContinue: null,
    afterEveryAction: null,
  };
  version: string;
  // 添加帮助信息 https://github.com/tj/commander.js#custom-help
  helpTexts: Array<{ position: 'beforeAll' | 'afterAll'; text: string }>;

  constructor(params: {
    leoConfig: { [key: string]: any };
    leoRC: { [key: string]: any };
    commands: ICommandSettings;
    actionHandler: IActionHandler;
    version: string;
    helpTexts: Array<{ position: 'beforeAll' | 'afterAll'; text: string }>;
    virtualPath: { [key: string]: string };
  }) {
    this.commandSettings = params.commands;
    this.program = new commander.Command();
    this.actionHandler = params.actionHandler;
    this.version = params.version;
    this.helpTexts = params.helpTexts || [];
    this.leoConfig = params.leoConfig;
    this.leoRC = params.leoRC;

    // 从 leoRC 中获取配置的 hooks
    this.hooks = merge({}, this.hooks, get(this.leoRC, 'cli.hooks', {}));
  }

  async start() {
    this.program.version(this.version);
    await this.createCLI();
  }

  async createCLI() {
    const extendsCommands = await this.getExtendsCommands();

    this.commandSettings = merge({}, extendsCommands, this.commandSettings);

    // commandSettings 优先级高于 extendsCommands
    // 避免自定义指令覆盖leo原生指令
    Object.keys(this.commandSettings).forEach((name) => {
      commandFactory({
        program: this.program,
        name,
        setting: this.commandSettings[name],
        actionCB: (commandName: string) => async (...args: any[]) => {
          this.hooks.beforeEveryAction &&
            (await this.hooks.beforeEveryAction(this, commandName, args));

          if (
            this.hooks.shouldActionContinue &&
            (await this.hooks.shouldActionContinue(this, commandName, args)) === false
          ) {
            return;
          }

          const rebuildedArgs = rebuildCommanderArgs(args);

          await this.actionHandler(
            commandName,
            {
              ...rebuildedArgs,
              unexpectedOptions: getUnexpectedOptions(rebuildedArgs.command.options),
            },
            get(this.commandSettings[name], 'action'),
          );

          this.hooks.afterEveryAction && this.hooks.afterEveryAction(this, commandName, args);
        },
      });
    });

    this.helpTexts.forEach((helpInfo) => {
      this.program.addHelpText(helpInfo.position, helpInfo.text);
    });

    this.program.parse(process.argv);
  }

  // 加载扩展指令，如果加载出错，仅展示错误信息，不中断主流程进行
  async loadExtendsCommands(pkgName: string, version: string) {
    return new Promise((resolve) => {
      loadPkg(pkgName, {
        version,
        private: true,
      })
        .then((pkg: any) => {
          resolve(pkg);
        })
        .catch((e: Error) => {
          log.error(e.message);
          log.error(`无法使用 ${pkgName}@${version} 提供的扩展命令，请联系开发者解决`);
          resolve(null);
        });
    });
  }
  async getExtendsCommands() {
    // 加载声明的扩展命令并处理为同 config.commands 中一样的格式
    // leorc 的命令声明优先级高于 leo config
    const extendsCommands = (
      await Promise.all(
        Object.entries({
          ...get(this.leoConfig, 'cmds', {}),
          ...get(this.leoRC, 'cmds', {}),
        }).map((commandInfo) => {
          const [pkgName, version] = commandInfo;
          return this.loadExtendsCommands(pkgName, version as string);
        }),
      )
    ).filter((v) => v);

    return extendsCommands.reduce(
      (commandStore: { [key: string]: any }, extend: { [key: string]: any }) => {
        commandStore[extend.name] = extend;
        delete commandStore[extend.name].name;
        return commandStore;
      },
      {},
    );
  }
}

export default CLI;
