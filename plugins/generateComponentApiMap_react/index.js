const path = require("path"); // 路径操作

const { generateNamespacePathMap } = require(path.join(
  __dirname,
  "./plugins/generateNamespacePathMap"
)); // generateNamespacePathMap 分析插件

const { generateComponentApiMap } = require(path.join(
    __dirname,
    "./plugins/generateComponentApiMap"
  )); // generateComponentApiMap 分析插件
  
exports.pluginList = [generateNamespacePathMap, generateComponentApiMap];
