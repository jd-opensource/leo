import path from 'path';
import log from './log';

interface IHooks {
  beforeAllInstall?: (name: string, version?: string) => void;
  allInstallSuccess?: (name: string, version?: string) => void;
  allInstallFail?: (name: string, version?: string) => void;
  afterJudgePkgExists?: (Exists: boolean) => void;
}

interface ILoadProps extends IHooks {
  version?: string;
  dev?: boolean;
  private?: boolean;
  beforeInstall?: (name: string, version?: string) => void;
  installSuccess?: (name: string, version?: string) => void;
  installFail?: (name: string, version?: string) => void;
}

const getPkgName = (name: string, version?: string) => `${name}${version ? `@${version}` : ''}`;

class LoadPkg {
  isDev: boolean;
  root: string;
  devRoot: string;
  hooks?: IHooks;

  constructor() {
    this.hooks = {
      beforeAllInstall: (name: string, version: string) =>
        log.warn(`未安装 ${getPkgName(name, version)}`),
      allInstallSuccess: (name: string, version: string) =>
        log.success(`${getPkgName(name, version)} 加载成功`),
      allInstallFail: (name: string, version: string) =>
        log.error(`${getPkgName(name, version)} 加载失败`),
    };
    this.load = this.load.bind(this);
  }

  async load(name: string, versionOrOptions?: ILoadProps | string) {
    this.init();
    let version;
    let options;

    if (versionOrOptions && typeof versionOrOptions === 'string') {
      version = versionOrOptions;
    }

    if (versionOrOptions && typeof versionOrOptions === 'object') {
      options = versionOrOptions;
      version = versionOrOptions.version;
    }

    const isDev = options?.dev === undefined ? this.isDev : options?.dev;

    try {
      const isPrivate = !!options?.private;

      const { pkgPath, storeDir } = this.getPkgPath(name, { version, isDev, isPrivate });

      const isPkgExists = this.isPkgExists(pkgPath);

      options?.afterJudgePkgExists?.(isPkgExists);

      if (!isPkgExists) {
        this.hooks?.beforeAllInstall?.(name, version);
        options?.beforeInstall?.(name, version);

        await this.installPkg(name, version || '', storeDir);

        options?.installSuccess?.(name, version);
        this.hooks?.allInstallSuccess?.(name, version);
      }

      const x = require(pkgPath);

      return x.default || x;
    } catch (e) {
      this.hooks?.allInstallFail?.(name, version);

      options?.installFail?.(name, version);

      // 抛出错误后由调用方捕获错误信息的调用栈会更改，所以在这里先log
      if (isDev) {
        log.error(e);
      }

      return Promise.reject(new Error(`${((e as unknown) as Error).message}`));
    }
  }

  // 返回包绝对地址
  private getPkgPath = (
    name: string,
    options: {
      version?: string;
      isDev?: boolean;
      isPrivate?: boolean;
    },
  ): {
    pkgPath: string;
    storeDir: string;
  } => {
    const { version, isDev, isPrivate } = options;
    // dev模式下，包目录读取本机全局包，用于 npm link 后本地调试
    if (isDev) {
      return {
        pkgPath: path.resolve(this.devRoot, `./${name}`),
        storeDir: this.devRoot,
      };
    }

    const storeDir = isPrivate ? `${this.root}/${name}/node_modules` : `${this.root}/node_modules`;
    const pkgName = version ? `_${name.replace('/', '_')}@${version}@${name}` : name;

    return {
      pkgPath: `${storeDir}/${pkgName}`,
      storeDir,
    };
  };

  // 安装 npm 依赖
  private async installPkg(name: string, version: string, storeDir?: string): Promise<any> {
    const npmi = require('npminstall');

    await npmi({
      production: true,
      root: path.resolve(storeDir, '../'),
      pkgs: [{ name, version }],
    });
  }

  private isPkgExists(pkgPath: string): boolean {
    try {
      require.resolve(pkgPath);
      return true;
    } catch (e) {
      return false;
    }
  }

  private init() {
    const globalDirectories = require('global-dirs');

    // 环境变量由 leo core 控制
    this.root = process.env.__NODEMODULEPATH || process.cwd();
    this.devRoot =
      process.env.__USEYARN === 'true'
        ? globalDirectories.yarn.packages
        : globalDirectories.npm.packages;
    this.isDev = process.env.__ISDEV === 'true';
    this.load = this.load.bind(this);
  }
}

const loadPkg = new LoadPkg().load;

export default loadPkg;
