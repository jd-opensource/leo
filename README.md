# leo

leo 脚手架是一款覆盖前端开发全链路、可扩展、可定制的终端运行的脚手架工具，并支持模板、构建器、扩展命令等丰富的周边生态扩展。

## 背景与介绍

在过去，脚手架虽然被前端广泛使用，但往往都局限于部门和团队内部，其中提供的模板、构建器等提效工具仅在内部使用，难以在团队、部门之间甚至公司层面做到复用和标准化，而新团队如需快速沉淀自己内部的规范，又需要额外开发脚手架工具，造成资源浪费。

leo 通过提供模板，构建器统一扩展来打破部门、团队之间模板和构建复用的壁垒，提高了新团队快速沉淀规范的效率，并且通过生成器和构建器分离，解耦了代码与构建配置的关联，使得模板和构建配置可以一对多或者多对一，减少了 webpack 等构建工具配置的困扰。


## 如何使用

leo 提供了丰富的配置项用于快速完成一套定制化的脚手架

```shell script
npm i @jdfed/leo-core
```

新建一个脚手架项目目录如下

```
yourProject
 |- bin
 |   |- index.js
 |- package.json
```

`package.json`中声明指令入口

```json
{
  "bin": {
    "yourCommand": "bin/index.js"
  }
}
```

在`bin/index.js`中进行配置`leo/core`

```js
#!/usr/bin/env node

const LeoCore = require('@jdfed/leo-core').default;

const customConfig = {
  // 模板仓库group
  gitTemplateGroupURL: '',
  // 项目中配置文件名，默认为 leorc.js
  rcFileName: 'xxx-rc.js',
};

const customCore = new LeoCore({
  config: customConfig,
  hooks: {
    beforeStart() {
      console.log(this.leoRC);
    },
    afterCommandExecute() {
      console.log(this);
    },
  },
});

customCore.start();
```

本地调试

```shell script
npm link 

yourCommand -h
```
