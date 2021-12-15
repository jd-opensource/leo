#!/usr/bin/env node

const LeoCore = require('../lib/index.js').default;

const core = new LeoCore();

core.start();

// ===================== 支持自定义 ====================

const config = {};
// // 模板仓库group
config.gitTemplateGroupURL = '';

// 模板模糊查询API
config.gitTemplateLikeNameURL =
  'http://coding.jd.com/webapi/teams/drip-templates/projects?nameLike=';

// 选择模板的命令行交互
config.questions.chooseTemplate = [
  {
    name: 'templateName',
    type: 'list',
    message: `选择模板，如需更多模板可查阅: http://coding.jd.com/teams/${config.gitTemplateGroupName}/`,
    choices: [
      {
        name: 'drip',
        value: 'drip',
      },
    ],
  },
];

// 对应命令行根名字，如drip init
config.rootName = 'drip';

// 项目中配置文件名，如.eslintrc.js
config.rcFileName = 'drip-rc.js';

// 帮助命令行
config.helpTexts = [
  { position: 'afterAll', text: '如遇相关问题可加入咚咚群：1022042900 咨询' },
  {
    position: 'afterAll',
    text: 'drip 使用文档：http://drip.jd.com/wiki/index.html#/',
  },
];

// 水滴自己的扩展命令
config.cmds = {
  add: {
    name: 'drip-add-cmd',
    version: '0.0.2',
  },
};

const customCore = new LeoCore({
  config,
  hooks: {
    beforeStart() {
      console.log(this.leoRC);
    },
  },
});

customCore.start();
