exports.generateComponentApiMap = function (analysisContext) {
    const mapName = "componentApiMap";
    // 在分析实例上下文挂载副作用
    analysisContext[mapName] = {};
  
    let currentComponentApiList = []; // 当前组件中所调用 API 的集合
  
    // 生成当前组件中所调用 API 的集合
    function _generateComponectApiList(context, ast, tsCompiler) {
      function walk(node) {
        tsCompiler.forEachChild(node, walk);
        if (
          tsCompiler.isStringLiteral(node) &&
          context.namespaceApiMap[node.text]
        ) {
          currentComponentApiList.push(context.namespaceApiMap[node.text]);
        }
      }
      walk(ast);
    }
  
    function generateComponentApiMap(context, tsCompiler, path, glob) {
      const { _scanFileAbsolutePath, createProgram } = context;
      const jsxFiles = glob.sync(`${_scanFileAbsolutePath}/src/**/*.jsx`);
      const jsFiles = glob.sync(`${_scanFileAbsolutePath}/src/**/*.js`);
  
      const componentFiles = jsxFiles.concat(jsFiles);
      const componentProgram = createProgram(componentFiles).program;
      componentFiles.forEach((fileName) => {
        const componentAst = componentProgram.getSourceFile(fileName);
        _generateComponectApiList(context, componentAst, tsCompiler);
        const uniqArr = Array.from(new Set(currentComponentApiList));
        context.componentApiMap[fileName] = uniqArr;
        currentComponentApiList = [];
      });
      return false; // true: 插件执行成功, 继续执行后序插件; false 不执行后续插件
    }
    // 返回组件中所包含的 API Map componentApiMap
    return {
      mapName: mapName,
      checkFun: generateComponentApiMap,
      afterHook: null,
    };
  };
  