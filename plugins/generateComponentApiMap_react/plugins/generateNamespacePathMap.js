exports.generateNamespacePathMap = function (analysisContext) {
    const mapName = "namespaceApiMap";
  
    let namespacePathMap = {}; // model 中的 namespace 与 method、service中的 method name 组成的 map
    let serviceMethodApiMap = {}; // service 文件中，方法与真实 API 的 Map
  
    // 在分析实例上下文挂载副作用
    analysisContext[mapName] = {};
  
    const { _scanFileAbsolutePath } = analysisContext || {};
  
    // 查找 Model 文件中引用的 Service 文件路径
    function _findServiceImportPath(ast, tsCompiler) {
      // 遍历AST寻找import节点
      let importApiPath = "";
      function walk(node) {
        tsCompiler.forEachChild(node, walk);
        if (
          tsCompiler.isImportDeclaration(node) &&
          node.moduleSpecifier &&
          node.moduleSpecifier.text &&
          /services|service/g.test(node.moduleSpecifier.text)
        ) {
          // 命中target
          importApiPath = node.moduleSpecifier.text;
        }
      }
      walk(ast);
      return importApiPath;
    }
  
    // 查找当前 namespace 路径
    function _findNamespace(ast, tsCompiler) {
      let currentNamespacePath = "";
      // 遍历AST寻找 namespace 节点
      function walk(node) {
        tsCompiler.forEachChild(node, walk);
        // 找到 Model 配置对象
        if (tsCompiler.isPropertyAssignment(node)) {
          if (node.name.escapedText === "namespace") {
            currentNamespacePath = node.initializer.text;
          }
        }
      }
      walk(ast);
      return currentNamespacePath;
    }
  
    function _findByCallNode(ast, tsCompiler) {
      let serviceName = "";
  
      function walk(node) {
        tsCompiler.forEachChild(node, walk);
  
        if (
          node &&
          tsCompiler.isCallExpression(node) &&
          node.expression &&
          node.expression.escapedText === "call" &&
          node.arguments &&
          node.arguments.length
        ) {
          // 从表达节点中找到 serviceName 节点，fe-core 项目中，该节点为第一个入参
          const serviceNameNode = node.arguments[0];
          if (tsCompiler.isPropertyAccessExpression(serviceNameNode)) {
            serviceName = serviceNameNode.name.escapedText;
          } else {
            serviceName = serviceNameNode.escapedText;
          }
        }
      }
  
      walk(ast);
  
      return serviceName;
    }
  
    // 遍历AST寻找 effects 节点,并记录下方法名以及service名
    function _findEffects(ast, tsCompiler, currentNamespacePath) {
      function walk(node) {
        tsCompiler.forEachChild(node, walk);
        // 找到 Model 配置对象
        if (tsCompiler.isPropertyAssignment(node)) {
          if (node.name.escapedText === "effects") {
            const methodsList = node.initializer.properties.map((_node) => {
              const methodName = _node.name.escapedText;
              if (_node.body) {
                return {
                  methodName,
                  serviceName: _findByCallNode(_node.body, tsCompiler),
                };
              }
            });
            namespacePathMap[currentNamespacePath] = methodsList;
          }
        }
      }
      walk(ast);
    }
  
    // 生成 service 文件中，方法与真实 API 的 Map
    function _generateServiceMethodApiMap(ast, tsCompiler, currentNamespacePath) {
      function walk(node) {
        tsCompiler.forEachChild(node, walk);
        // 如果是 function node，则取其名
        if (node && tsCompiler.isFunctionDeclaration(node)) {
          const returnNode = node.body.statements.find((statement) =>
            tsCompiler.isReturnStatement(statement)
          );
          if (!returnNode) return;
          const realApiNode = returnNode.expression.arguments?.find((argument) =>
            tsCompiler.isStringLiteral(argument)
          );
          serviceMethodApiMap[
            `${currentNamespacePath}/${node.name.escapedText}`
          ] = realApiNode?.text;
        } else if (node && tsCompiler.isVariableDeclaration(node)) {
          if (
            node.initializer &&
            node.initializer.arguments &&
            node.initializer.arguments.length
          ) {
            serviceMethodApiMap[
              `${currentNamespacePath}/${node.name.escapedText}`
            ] = node.initializer.arguments[0].text || "";
          }
        }
      }
      walk(ast);
    }
  
    function generateNamespacePathMap(context, tsCompiler, path, glob) {
      const that = context;
      const { createProgram } = that;
      // React Umi 项目中所有 Model 文件路径集合
      const modelFiles = glob
        .sync(`${_scanFileAbsolutePath}/src/**/model.js`)
        .concat(glob.sync(`${_scanFileAbsolutePath}/src/**/models/*.js`));
      const modelProgram = createProgram(modelFiles).program;
      // service 文件中，方法与真实 API 的 Map
      modelFiles.forEach((fileName) => {
        const modelAst = modelProgram.getSourceFile(fileName);
        const serviceFilePath = _findServiceImportPath(modelAst, tsCompiler);
        const currentNamespacePath = _findNamespace(modelAst, tsCompiler);
        _findEffects(modelAst, tsCompiler, currentNamespacePath);
        const serviceFileName = path.resolve(
          path.dirname(fileName),
          serviceFilePath
        );
        const absolateServiceFileName = serviceFileName.includes("@")
          ? serviceFileName.replace(/src(.*?)\/@/, "src")
          : serviceFileName;
        const serviceProgram = createProgram([
          `${absolateServiceFileName}.js`,
        ]).program;
        const serviceAst = serviceProgram.getSourceFile(
          `${absolateServiceFileName}.js`
        );
        _generateServiceMethodApiMap(
          serviceAst,
          tsCompiler,
          currentNamespacePath
        );
      });
      Object.entries(namespacePathMap).forEach((item) => {
        const [namespace, effects] = item;
        effects.forEach((effect) => {
          that.namespaceApiMap[`${namespace}/${effect.methodName}`] =
            serviceMethodApiMap[`${namespace}/${effect.serviceName}`];
        });
      });
      return true; // true: 插件执行成功, 继续执行后序插件; false 不执行后续插件
    }
  
    // 返回分析所有的model文件，得到 namespacePathMap 即所有 namespace:effects[] 的方法
    return {
      mapName: mapName,
      checkFun: generateNamespacePathMap,
      afterHook: null,
    };
  };
  