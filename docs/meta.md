# meta.js

用于控制模版最终渲染和生成的项目文件。

## 完整示例

```js
module.exports = {
  // generator钩子函数
  hooks: {
    beforeGenerate: (generator: Generator) => {
      // warn:不建议return true, 如果返回值为true将终止后续流程
      console.log('template beforeGenerate is run', generator);
      // return true
    },
    afterGenerate: (generator: Generator) => {
      console.log('template afterGenerate is run', generator);
    },
    /**
     * 参考项目https://github.com/segmentio/metalsmith
     * 以及@types/metalsmith
     * 渲染占位符时的hook，如果配置了该函数，将由你自己接管渲染占位符
     */
    renderTemplatePlaceholder: (generator: Generator) => {
      return (files: IFiles, metalsmith: Metalsmith, done: Function) => {};
    },
    /**
     * 最终渲染文件的hook，理论上可以做任何事包括渲染占位符
     */
    renderTemplateFile: (generator: Generator) => {
      return (files: IFiles, metalsmith: Metalsmith, done: Function) => {};
    }
  },
  // handlebars的helpers扩展函数
  // https://handlebarsjs.com/api-reference/runtime.html#handlebars-registerhelper-name-helper
  helpers: {
    if_equal(v1, v2, opts) {
      return v1 === v2
        ? opts.fn(this)
        : opts.inverse(this)
    },
  }
  // 交互式问题
  // 参考inquirer https://github.com/SBoudrias/Inquirer.js
  prompts: [
    {
      name: 'projectDesc',
      type: 'string',
      require: false,
      default: 'A test description',
      message: 'A project description'
    },
    {
      name: 'build',
      type: 'list',
      message: '构建方式',
      choices: [
        {
          name: '快速构建方案',
          value: 'platfomA',
          short: 'platfomA',
        },
        {
          name:'稳定构建方案',
          value: 'platfomB',
          short: 'platfomB',
        },
      ]
    },
    {
      name: 'router',
      type: 'confirm',
      message: '是否安装vue-router?'
    },
    {
      // 当用户的build的选项为platfomA时执行此问题
      when: (answer) => { return answer.build == 'platfomA' },
      name: 'unit',
      type: 'confirm',
      message: '是否需要单元测试'
    }
  ],
  // 根据用户对相关name的回答，进行文件的过滤删除
  // 遵循glob的语法 https://rgb-24bit.github.io/blog/2018/glob.html
  filterFilesMap: {
    'test/unit/**/*': 'unit',
    'src/router/**/*': 'router'
  }
  // 编译白名单，考虑到handlebars编译{{ xxx }}的值时，可能会编译到一些不需要编译的文件导致报错
  // 将需要handlebars需要编译的文件写在compileWhiteList中(默认会编写leorc.js和package.json，无需额外添加leorc.js和package.json)
  // 若不传compileWhiteList或为空时，默认编译所有文件
  // 遵循glob的语法 https://rgb-24bit.github.io/blog/2018/glob.html
  compileWhiteList: [
    'src/router/**/*',
    'test/unit/**/*',
  ]
}
```

## 字段解释

### prompts

**类型：** Array

**定义：** 模板配置询问阶段，模板开发者可设置一些选项供使用者选择，后期渲染阶段会根据用户的选择来控制模板的生成。

**规范：** 由于模板配置询问功能基于[Inquirer.js](https://www.npmjs.com/package/inquirer)实现，所以 prompts 书写的规则需遵循[Inquirer.js](https://www.npmjs.com/package/inquirer)规范。

**示例：**

```js
prompts: [
  {
      name: 'build',
      type: 'list',
      message: '构建方式',
      choices: [
        {
          name: '快速构建方案',
          value: 'platfomA',
          short: 'platfomA',
        },
        {
          name:'稳定构建方案',
          value: 'platfomB',
          short: 'platfomB',
        },
      ]
    }
  ...
]
```

### filterFilesMap

**类型：** Object

**定义：** 获取模板配置询问用户的配置选择，过滤掉不需要生成的文件。

::: tip
`filterFilesMap`是由文件名作为`key`，`prompts`问题中的 name 字段作为`value`的一个对象，例如：

```js
prompts: [
  {
    name: 'router',
    type: 'confirm',
    message: '是否安装react-router?'
  }
]
filterFilesMap: {
  'src/router/**/*': 'router'
}
```

若用户 router 选项选择了 N，则最终不会生成 src 下 router 及 router 目录下所有文件。
:::

**规范：** 文件名的书写规范遵循[glob 的语法](https://rgb-24bit.github.io/blog/2018/glob.html)

### helpers

**类型：** Object

**定义：** 支持`模版开发者`在开发中使用 Handlebars 的 helpers 控制文件内容的生成。

**规范：** helpers 函数规范遵循[Handlebars 的 registerHelper](https://handlebarsjs.com/api-reference/runtime.html#handlebars-registerhelper-name-helper)规则。

**示例：**

```js
  helpers: {
    if_equal(v1, v2, opts) {
      return v1 === v2
        ? opts.fn(this)
        : opts.inverse(this)
    },
  }
```

### compileWhiteList

**类型：** Array

**定义：** 模版编译白名单。

::: v-pre
::: tip
由于`handlebars`是根据双花括号`{{}}`去匹配并渲染变量。当在`react`或者`vue`的项目中，其内部语法 `{{variable}}`与`handlebars`语法`{{replaceName}}`冲突，若希望`{{variable}}`不被`handlebars`编译，可在变量前添加转义符`{{variable}}`写作`\{{variable}}`来防止`handlebars`编译变量。

除了上述的方法可以阻止 handlebars 编译，还可以将需要编译文件写入`compileWhiteList`中，这样只会编译`compileWhiteList`中文件，由于 generator 会默认编译 leorc.js 和 package.json 文件所以无需额外填写。若`compileWhiteList`为空默认编译项目所有文件。
:::

**示例：**

```js
compileWhiteList: ['src/router/**/*', 'test/unit/**/*'];
// 实际编译文件有'src/router/**/*', 'test/unit/**/*', 'package.json', 'leorc.js'
```

**规范：** 文件名的书写规范遵循[glob 的语法](https://rgb-24bit.github.io/blog/2018/glob.html)

### hooks

快速理解不同 hooks 执行的时机可参考[此处](http://doc.jd.com/feb-book/leo/advance/generator.html)。

#### hook.beforeGenerate

**类型：** Function

**定义：** 此函数为 Generator 的前置 hook 函数，此函数不建议 return true, 如果返回值为 true 将终止后续流程。

#### hooks.afterGenerate

**类型：** Function

**定义：** 此函数为 Generator 的后置 hook 函数。

#### hooks.renderTemplatePlaceholder

**类型：** Function

**定义：** 渲染占位符时的 hook 函数，如果配置了该函数，将由模版开发者模版控制占位符的渲染。

#### hooks.renderTemplateFile

**类型：** Function

**定义：** 最终渲染文件的 hook，此函数为最终文件的生成函数。

**示例：**

```js
  hooks: {
    beforeGenerate: (generator: Generator) => {},
    afterGenerate: (generator: Generator) => {},
    renderTemplatePlaceholder: (generator: Generator) => {
      return (files: IFiles, metalsmith: Metalsmith, done: Function) => {};
    },
    renderTemplateFile: (generator: Generator) => {
      return (files: IFiles, metalsmith: Metalsmith, done: Function) => {};
    }
  },
```
