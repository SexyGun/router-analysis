const path = require("path"); // 路径操作

const { generateSourceMapTree } = require(path.join(
  __dirname,
  "./plugins/generateSourceMapTree"
)); // generateSourceMapTree 分析插件
  
exports.pluginList = [generateSourceMapTree];
