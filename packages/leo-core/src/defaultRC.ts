export interface IRC {
  // templateOrigin?: string;
  cli?: {
    hooks?: {
      beforeEveryAction?: (cli: any, commandName: string, args: any[]) => void | Promise<void>;
      /*
       * 如果返回 false 则会拦截后续行为，完全自己代理
       * 比如自己创建的命令，需要return true
       */
      shouldActionContinue?: (
        cli: any,
        commandName: string,
        args: any[],
      ) => boolean | Promise<boolean>;
      afterEveryAction?: (commandName: string, args: any[]) => void | Promise<void>;
    };
  };

  testAction?: (options: { [key: string]: any }) => Promise<boolean>;
  lintAction?: (options: { [key: string]: any }) => Promise<boolean>;
  // 发布之前test，lint，build是否要并行
  isPrePublishParallel?: boolean;

  // 对应事后，在rc中定义
  builder?: {
    name: string;
    version?: string;
    hooks?: {
      beforeDev?: (Builder: any) => Promise<void>;
      afterDev?: (Builder: any) => Promise<void>;

      beforeBuild?: (Builder: any) => Promise<void>;
      afterBuild?: (Builder: any) => Promise<void>;
    };
  };
  publisher?: {
    name: string;
    version?: string;
    hooks?: {
      beforePublish?: (Publisher: any) => Promise<void>;
      afterPublish?: (Publisher: any) => Promise<void>;
    };
  };
}

const defaultRC: IRC = {};

export default defaultRC;
