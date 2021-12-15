module.exports = {
  extends: ['eslint-config-ali/typescript/node', 'prettier', 'prettier/@typescript-eslint'],
  rules: {
    'no-empty': [2, { allowEmptyCatch: true }],
    'no-console': [0],
    '@typescript-eslint/no-require-imports': [0],
    'no-param-reassign': [0],
    'no-useless-return': [0],
  },
};
