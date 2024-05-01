const path = require("path"); // 路径操作
const { getAnalysisPluginMap } = require(path.join(
  __dirname,
  "./getAnalysisPluginMap"
)); // generateComponentApiMap_vue 分析插件
const [ABSOLUTE_PATH, type] = process.argv.slice(2);
console.log(process.argv.slice(2));
const CodeAnalysis = require(path.join(__dirname, "./lib/analysis.js")); // 解析模块

if (!ABSOLUTE_PATH) {
  console.error("error!请输入分析程序路径");
}
if (!type) {
  console.error("error!请输入分析程序项目类型（vue、react）");
}
const codeAnalysis = new CodeAnalysis({
  scanFileAbsolutePath: ABSOLUTE_PATH,
  analysisPluginMap: {
    ...getAnalysisPluginMap(type),
  },
});

console.time("程序执行时间");
codeAnalysis.analysis();
console.timeEnd("程序执行时间");
