# leo-utils

为 leo 及其生态提供的工具库

## loadPkg

动态加载

### 基础使用

```js
import { loadPkg } from '@leo/leo-utils';

(async () => {
  const puppeteer = await loadPkg('puppeteer', '10.0.0');
})();
```

### 高级使用

```js
import { loadPkg, log } from '@leo/leo-utils';

(async () => {
  const puppeteer = await loadPkg('puppeteer', {
    version: '10.0.0',
    private: true,
    beforeInstall: () => {
      log.info('Log info when beforeInstall');
    },
    installSuccess: () => {
      log.success('Log info when installSuccess');
    },
    installFail: () => {
      log.error('Log info when installFail');
    },
  });
})();
```

### API

#### loadPkg

| 属性名                         | 描述                     | 类型                                       | 默认值  |
| ------------------------------ | ------------------------ | ------------------------------------------ | ------- |
| name                           | 安装路径                 | `string`                                   | `--`    |
| versionOrOptions               | 版本号或相关配置         | `string` / `object`                        | `--`    |
| versionOrOptions.version       | 版本号                   | `string`                                   | `false` |
| versionOrOptions.dev           | 本次安装是否为开发模式   | `boolean`                                  | `false` |
| versionOrOptions.private       | 是否将安装的包单独隔离   | `boolean`                                  | `false` |
| versionOrOptions.beforeInstall | 本次安装后执行的声明周期 | `(name: string, version?: string) => void` | `--`    |
| versionOrOptions.afterInstall  | 本次安装前执行的声明周期 | `(name: string, version?: string) => void` | `--     |

## log

基于 [signale](https://www.npmjs.com/package/signale) 封装的 log 工具

### 基础使用

```js
import { log } from '@leo/leo-utils';

log.error('');
log.fatal('');
log.fav('');
log.info('');
log.star('');
log.success('');
log.wait('');
log.warn('');
log.complete('');
log.pending('');
log.note('');
log.start('');
log.pause('');
log.debug('');
log.await('');
log.watch('');
log.log('');
```

### 高级使用

```js
import { log } from '@leo/leo-utils';

// 在输出时标识你的作用域，用于区分输出
const myLog = log.scope('plugin scope');

myLog.info('info');

// [plugin scope] › ℹ  info      Info will has scope remark
```

### 注意

- `log.debug` 是否输出由 `leoConfig.isDebug` 来控制，你可以通过使用 `log.debug` 来定位线上问题


