const { src, dest, series, watch } = require('gulp');
const gulpTypescript = require('gulp-typescript');
const del = require('del');
const rename = require('gulp-rename');
const eslint = require('gulp-eslint');
const cache = require('gulp-cached');
const remember = require('gulp-remember');
const uglify = require('gulp-uglify');

const dir = require('path').resolve(process.cwd(), 'packages', process.env.DIR);

function buildTs() {
  const tsProject = gulpTypescript.createProject(`${dir}/tsconfig.json`);

  return src(`${dir}/src/**/*.ts`)
    .pipe(cache('build-ts'))
    .pipe(tsProject())
    .pipe(
      rename((path) => {
        path.dirname = path.dirname.replace(`${dir}/src`, `${dir}/lib`);
      }),
    )
    .pipe(remember('build-ts'))
    .pipe(dest(`${dir}/lib`));
}
function uglifyJS() {
  return src(`${dir}/lib/**/*.js`)
    .pipe(
      uglify({
        output: { indent_level: 0 },
      }),
    )
    .pipe(dest(`${dir}/lib`));
}
function moveJSON() {
  return src(`${dir}/src/**/*.json`).pipe(dest(`${dir}/lib`));
}

function clean(cb) {
  del(`${dir}/lib`).then(() => cb());
}

function buildPackages() {
  return series(buildTs, moveJSON);
}

function lint() {
  return src(`${dir}/src/**/*.ts`)
    .pipe(cache('linting'))
    .pipe(
      eslint({
        quiet: false,
        fix: true,
      }),
    )
    .pipe(eslint.format())
    .pipe(remember('linting'))
    .pipe(eslint.failAfterError());
}

function watchTask() {
  watch(`${dir}/src/**/*.ts`, series(lint));
  watch(`${dir}/src/**/*.ts`, series(buildTs));
  watch(`${dir}/src/**/*.json`, series(moveJSON));
}

exports.default = series(clean, buildPackages(), lint, watchTask);
exports.clean = clean;
exports.build = series(clean, buildPackages(), lint, uglifyJS);
exports.lint = lint;
