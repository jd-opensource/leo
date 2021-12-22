# 全局配置

**以下用 leo 作为你指定的命令名**

更改配置可有助于开发 template，builder 以及 publisher

你可以使用 `config` 指令来控制全局配置

```shell script
leo config -h
Usage: leo config [options] [command]

Commands:
  set <key>=<value> [<key>=<value]  设置 leo config 参数
  get <key>                         获取 leo config 参数
  delete <key>                      删除 leo config 参数
  list                              查看 leo config 配置
  help [command]                    display help for command
```

## 默认配置

```json
{
  "isDebugger": false,
  "isDev": true,
  "isGrayUser": false,
  "forceUpdate": true,
  "useYarn": false,
  "cmds": {},
  "isAlwaysCheck": true
}
```

## 字段解释

### isDebugger

当前是否为 debug 模式，开启后会输出 `@leo/core` 中的关键信息。

**默认值**：`false`

### isDev

当前是否为开发模式

开启后加载资源的路径会由 `leo` 私有路径变为全局加载，可用于本地调试 builder 等。

**默认值**：`false`

### isGrayUser

当前用户是否为灰度用户，设置为 true 后，当发布 leo 灰度版本也会提示更新使用。

**默认值**：`false`

### focusUpdate

如有最新版本，是否强制升级

**默认值**：`true`

### useYarn

是否使用 yarn，当本地开发 builder 等扩展时，如果使用 yarn link 连接至全局，则需开启次选项。

### cmds

全局指令扩展

以 `xxx-cmd` 扩展指令为例，你可以使用 `leo config set cmds.xxx-cmd=1.0.0` 来添加全局指令，之后你可以在任意项目中通过 `leo xxx` 来使用这个扩展指令。

[如何编写扩展指令](http://doc.jd.com/feb-book/leo/advance/cmd.html)

### isAlwaysCheck

是否每次命令，都要进行检查。如果关闭，你也可以`leo check`单独使用

**默认值**：`true`
