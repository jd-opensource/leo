import { IStaticConfig, ILocalConfig } from './interface';

export const localStaticConfig: ILocalConfig = {
  isDebug: false,
  isDev: false,
  isGrayUser: false,
  forceUpdate: true,
  useYarn: false,
  fuzzyTemp: true,
  cmds: {},
};

export const staticConfig: IStaticConfig = {
  rootName: 'leo',
  rcFileName: 'leorc.js',
  version: '1.0.0',
  // leo-generator 根据此地址 clone 模板
  gitTemplateGroupURL: '',
  // leo init 模糊查询接口
  gitTemplateGroupQueryURL: '',
  // git 查询接口需要的请求头
  gitQueryHeader: {},
  npmRegistry: 'https://registry.npmjs.org/',
  remoteConfigUrl: ``,
  cli: {
    name: '@leo/cli',
    version: '1.0.0',
  },
  generator: {
    name: '@leo/generator',
    version: '1.0.0',
  },
  commands: {
    init: {
      cmdDesc: '创建一个项目',
      arguments: '[name]',
      argumentsDesc: {
        name: '模版名 不传则会推荐',
      },
      options: [
        ['--use-cache', '使用本地缓存的模板', false],
        ['-r, --repo <repo>', '需要关联的 git 仓库地址'],
      ],
    },
    dev: {
      cmdDesc: '本地开发',
    },
    build: {
      cmdDesc: '构建项目',
    },
    lint: {
      cmdDesc: '检查代码',
    },
    test: {
      cmdDesc: '执行测试',
    },
    config: {
      cmdDesc: '设置/获取 leo config',
      subCommands: {
        set: {
          cmdDesc: '设置 leo config 参数',
          arguments: '<key>=<value> [<key>=<value> ...]',
        },
        get: {
          cmdDesc: '获取 leo config 参数',
          arguments: '<key>',
        },
        delete: {
          cmdDesc: '删除 leo config 参数',
          arguments: '<key>',
        },
        list: {
          cmdDesc: '查看 leo config 配置',
        },
      },
      helpTexts: [
        {
          position: 'after',
          text: '欢迎使用 leo',
        },
      ],
    },
  },
  questions: {
    chooseTemplate: [],
    init: [
      {
        name: 'projectName',
        type: 'string',
        require: true,
        demand: true,
        message: '生成项目所在文件夹名称',
        validate: (val: string) => {
          return val ? true : '请输入生成项目所在文件夹名称';
        },
      },
      {
        name: 'useInstall',
        type: 'list',
        message: '是否需要在初始化后安装依赖?',
        choices: [
          {
            name: '使用 npm install',
            value: 'npm',
          },
          {
            name: '使用 yarn install',
            value: 'yarn',
          },
          {
            name: '不需要安装',
            value: 'custom',
          },
        ],
      },
    ],
  },
};
