const path = require("path"); // 路径操作

const { pluginList: generateComponentApiMap_react } = require(path.join(
  __dirname,
  "./plugins/generateComponentApiMap_react"
)); // generateComponentApiMap_react 分析插件

const { pluginList: generateSourceMapTree_react } = require(path.join(
  __dirname,
  "./plugins/generateSourceMapTree_react"
)); // generateSourceMapTree_react 分析插件

const { pluginList: generateRouterApiMap_react } = require(path.join(
  __dirname,
  "./plugins/generateRouterApiMap_react"
)); // generateSourceMapTree_react 分析插件

const { pluginList: generateComponentApiMap_vue } = require(path.join(
  __dirname,
  "./plugins/generateComponentApiMap_vue"
)); // generateComponentApiMap_vue 分析插件

const { pluginList: generateSourceMapTree_vue } = require(path.join(
  __dirname,
  "./plugins/generateSourceMapTree_vue"
)); // generateSourceMapTree_vue 分析插件

const { pluginList: generateRouterApiMap_vue } = require(path.join(
  __dirname,
  "./plugins/generateRouterApiMap_vue"
)); // generateRouterApiMap_vue 分析插件

const { pluginList: generateRouterArr } = require(path.join(
  __dirname,
  "./plugins/generateRouterArr"
)); // generateRouterArr 分析插件

exports.getAnalysisPluginMap = (type) => {
  const typeMap = {
    vue: {
      stepOnePluginList: generateComponentApiMap_vue,
      stepTwoPluginList: generateSourceMapTree_vue,
      stepThreePluginList: generateRouterApiMap_vue,
    },
    react: {
      stepOnePluginList: generateComponentApiMap_react,
      stepTwoPluginList: generateSourceMapTree_react,
      stepThreePluginList: generateRouterApiMap_react,
    },
    tool: {
      toolPluginList: generateRouterArr,
    }
  };
  return typeMap[type];
};
