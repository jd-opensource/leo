// program
//   .arguments('<username> [password]')
//   .options: [
//     ['-uc, --use-cache', 'use cache', false],
//   ],
//   .action((username, password, options, command) => {
//     console.log('username:', username);
//     console.log('environment:', password || 'no password given');
//   });


/**
 * 由于 commander 的机制，在 arguments 声明的变量会依次传入 action 中，options 和 command 对象会在最后传入
 * 本函数用于处理参数，使其格式化
 * @returns {Promise}
 */

export default (args: any[]) => {
  // args 中第一个出现类型为 object 的即为 options
  const argumentsIndex = args.findIndex((v) => typeof v === 'object');
  return {
    arguments: args.slice(0, argumentsIndex),
    options: args[argumentsIndex],
    command: args[argumentsIndex + 1],
  };
};
