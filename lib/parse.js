const path = require("path"); // 路径操作
const md5 = require("js-md5"); // md5加密
const vueCompiler = require("@vue/compiler-dom"); // Vue编译器
const tsCompiler = require("typescript"); // TS编译器
const { getCode, writeTsFile } = require(path.join(__dirname, "./file")); // 文件工具
const { VUETEMPTSDIR } = require(path.join(__dirname, "./constant")); // 常量模块

const OPTIONS = {
  allowJs: true, // 允许编译 javascript 文件
};

// 解析传入 vue 文件列表中的ts script片段，生成统一的 program
exports.parseVue = function (fileNameList) {
  // 统一生成 Vue 文件中的 ts script 片段文件
  let tmpTsFileList = [];
  let realFilePathTmpTsFilePathMap = {};
  fileNameList.forEach((fileName) => {
    // 获取vue代码
    const vueCode = getCode(fileName);
    // 解析vue代码
    const result = vueCompiler.parse(vueCode);
    const children = result.children;
    // 获取script片段
    let tsCode = "";
    children.forEach((element) => {
      if (element.tag == "script") {
        tsCode = element.children[0]?.content;
      }
    });
    if (!tsCode) return;
    const ts_hash_name = md5(fileName);
    // 将ts片段写入临时目录下的ts文件中
    writeTsFile(tsCode, `${VUETEMPTSDIR}/${ts_hash_name}`);
    const vue_temp_ts_name = path.join(
      process.cwd(),
      `${VUETEMPTSDIR}/${ts_hash_name}.ts`
    );
    tmpTsFileList.push(vue_temp_ts_name);
    realFilePathTmpTsFilePathMap[fileName] = vue_temp_ts_name;
  });

  // 将ts代码转为 program
  return {
    program: tsCompiler.createProgram(tmpTsFileList, OPTIONS),
    realFilePathTmpTsFilePathMap,
  };
};

// 解析传入文件列表中的代码，生成统一的 program
exports.parseTs = function (fileNameList) {
  // 将ts代码转化为 TsPrograme
  return {
    program: tsCompiler.createProgram(fileNameList, OPTIONS),
  };
};
