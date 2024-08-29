const path = require("path"); // 路径操作
const glob = require("glob");
const fs = require("fs");
const tsCompiler = require("typescript");

const { parseVue, parseTs } = require(path.join(__dirname, "./parse")); // 解析模块
const { writeJsonFile } = require(path.join(__dirname, "./file")); // 解析模块

class CodeAnalysis {
  constructor(options) {
    // 私有属性
    this._scanFileAbsolutePath = options.scanFileAbsolutePath; // 扫描文件的绝对地址
    this._isScanVue = options.isScanVue || false; // 是否扫描Vue配置
    this._analysisPluginMap = options.analysisPluginMap || {
      stepOnePluginList: [],
      stepTwoPluginList: [],
      stepThreePluginList: [],
    }; // 所需要插件配置
    // 公共属性
    this.stepOnePluginsQueue = [];
    this.stepTwoPluginsQueue = [];
    this.stepThreePluginsQueue = [];
    this.importApiPath = ""; // service 引入地址
    this.currentNamespacePath = ""; // 当前namespace
    this.namespacePathMap = {}; // model 文件下的 namespaceMap: { namespace: [ { methodName, serviceName} ] }
    this.serviceMethodApiMap = {};
    this.namespaceApiMap = {}; // namespace与后端真实Api的Map
    this.currentComponentApiList = []; // 当前组件所包含 Api 的列表
    this.componentApiMap = {}; // key：组件文件地址，value：组件所包含 api 列表
    this.routerApiMap = {}; // key：路由地址，value：组件所包含 api 列表
    this.currentChildrenPath = []; // 当前节点子路径
    this.componentTree = []; // 组件间引用树
  }

  /**
   *
   * @param {*} fileNameList 需要生成 program 的文件地址列表
   * @param {*} isVue 是否为 Vue 文件
   * @returns
   */
  // 生成 AST 程序
  createProgram(fileNameList, isVue = false) {
    if (isVue) {
      return parseVue(fileNameList);
    } else {
      return parseTs(fileNameList);
    }
  }

  // 注册插件
  _installPlugins(plugins, queueName) {
    this[queueName] = [];
    if (plugins.length > 0) {
      plugins.forEach((item) => {
        // install Plugin
        if (item) {
          this[queueName].push(item(this));
        }
      });
    }
  }

  // 执行插件队列中的checkFun函数
  _runAnalysisPlugins(queueName) {
    if (this[queueName].length > 0) {
      for (let i = 0; i < this[queueName].length; i++) {
        const checkFun = this[queueName][i].checkFun;
        if (!checkFun(this, tsCompiler, path, glob, fs)) {
          break;
        }
      }
    }
  }

  // 入口函数
  analysis() {
    const { stepOnePluginList, stepTwoPluginList, stepThreePluginList } =
      this._analysisPluginMap || {};
    const strategies = {
      // step 1 生成页面组件与组件内包含 API 的 Map
      stepOnePluginList: new AnalysisStrategy(stepOnePluginList, "stepOnePluginsQueue", "componentApiMap"),
      // step 2 分析生成所有组件生成组件间的引用关系树
      stepTwoPluginList: new AnalysisStrategy(stepTwoPluginList, "stepTwoPluginsQueue", "componentTree"),
      // step 3 生成路由下所有API
      stepThreePluginList: new AnalysisStrategy(stepThreePluginList, "stepThreePluginsQueue", "routerApiMap"),
    };
    for (let strategy in strategies) {
      if (this._analysisPluginMap[strategy]) {
        strategies[strategy].execute(this);
      }
    }
  }
}

// 分析策略类
class AnalysisStrategy {
  constructor(pluginList, queueName, mapName) {
    this.pluginList = pluginList; // 插件列表
    this.queueName = queueName;   // 插件队列名称
    this.mapName = mapName;       // 生成的 Map 名称  
  }

  execute(_this) {
    // 注册插件到队列
    _this._installPlugins(this.pluginList, this.queueName);
    // 执行插件队列中的checkFun函数
    _this._runAnalysisPlugins(this.queueName);
    // 生成结果文件
    writeJsonFile(
      _this[this.mapName],
      `${_this._scanFileAbsolutePath}/${this.mapName}`
    );
  }
}
module.exports = CodeAnalysis;
