const path = require("path"); // 路径操作

const { generateRouterApiMap } = require(path.join(
  __dirname,
  "./plugins/generateRouterApiMap"
)); // generateRouterApiMap 分析插件
const { jsonToExcel } = require(path.join(
  __dirname,
  "./plugins/jsonToExcel"
)); // jsonToExcel 分析插件
exports.pluginList = [generateRouterApiMap, jsonToExcel];
