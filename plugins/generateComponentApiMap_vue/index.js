const path = require("path"); // 路径操作

const { generateComponentApiMap } = require(path.join(
    __dirname,
    "./plugins/generateComponentApiMap"
  )); // generateComponentApiMap 分析插件
  
exports.pluginList = [generateComponentApiMap];
