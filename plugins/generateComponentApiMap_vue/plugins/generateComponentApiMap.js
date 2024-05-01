const path = require("path"); // 路径操作
const glob = require("glob");
const tsCompiler = require("typescript"); // TS编译器

exports.generateComponentApiMap = function (analysisContext) {
  const mapName = "componentApiMap";
  // 在分析实例上下文挂载副作用
  analysisContext[mapName] = {};

  let currentComponentApiList = []; // 当前组件中所调用 API 的集合

  // crs-fe-pc 项目特殊处理，该项目一部分 API 集中存放在 apiUrl 文件中
  function _generateCrsApiMap() {
    const { _scanFileAbsolutePath, createProgram } = analysisContext;
    const filePath = `${_scanFileAbsolutePath}/src/api/apiUrl.js`;
    const { program } = createProgram([filePath]);
    const ast = program.getSourceFile(filePath);
    let result = {};
    function walk(node) {
      tsCompiler.forEachChild(node, walk);
      if (
        tsCompiler.isVariableDeclaration &&
        node.initializer &&
        tsCompiler.isObjectLiteralExpression(node.initializer) &&
        node.initializer.properties &&
        node.initializer.properties.length
      ) {
        const objectName = node.name.escapedText;
        const methodApiMap = node.initializer.properties.reduce((prev, cur) => {
          return {
            ...prev,
            [cur.name.escapedText]: cur.initializer.text,
          };
        }, {});
        result[objectName] = methodApiMap;
      }
    }

    walk(ast);

    analysisContext["crsApiMap"] = result;
  }

  function _findRealApiByMethodName(
    methodNameList,
    apiFilePath,
    componentFilePath
  ) {
    // 实际调用后端 API 地址
    let realApiUrlList = [];
    const { createProgram } = analysisContext;
    const serviceFileName = path.resolve(
      path.dirname(componentFilePath),
      apiFilePath
    );
    const absolateServiceFileName = serviceFileName.includes("@")
      ? serviceFileName.replace(/src(.*?)\/@/, "src")
      : serviceFileName;
    // Js 项目处理方式
    let realPath = absolateServiceFileName.includes(".js")
      ? absolateServiceFileName
      : `${absolateServiceFileName}.js`;
    const { program: serviceProgram } = createProgram([realPath]);
    let serviceAst = serviceProgram.getSourceFile(realPath);
    if (!serviceAst) {
      // 第一版先打补丁，后续再想想如何优化
      // 生成的 AST 为空，说明引入的 API 文件路径有问题
      // 需要手动补充 index路径
      realPath = `${absolateServiceFileName}/index.js`;
      serviceAst = createProgram([realPath]).program.getSourceFile(realPath);
    }
    // Ts 项目处理方式
    if (!serviceAst) {
      let _realPath = absolateServiceFileName.includes(".ts")
        ? absolateServiceFileName
        : `${absolateServiceFileName}.ts`;
      const { program: serviceProgram } = createProgram([_realPath]);
      serviceAst = serviceProgram.getSourceFile(_realPath);
      if (!serviceAst) {
        // 第一版先打补丁，后续再想想如何优化
        // 生成的 AST 为空，说明引入的 API 文件路径有问题
        // 需要手动补充 index路径
        _realPath = `${absolateServiceFileName}/index.ts`;
        serviceAst = createProgram([_realPath]).program.getSourceFile(
          _realPath
        );
      }
    }
    function walk(node) {
      tsCompiler.forEachChild(node, walk);
      if (!node) {
        realApiUrlList.push(`${realPath}为无效调用`);
        return;
      }
      if (
        tsCompiler.isFunctionDeclaration(node) &&
        node.name &&
        node.name.escapedText &&
        methodNameList.includes(node.name.escapedText)
      ) {
        const { statements } = node.body;
        // 情况 1 url 定义在 return 返回体中
        const { expression } =
          statements.find((item) => tsCompiler.isReturnStatement(item)) || {};
        const { properties } =
          expression?.arguments?.find((item) =>
            tsCompiler.isObjectLiteralExpression(item)
          ) || {};
        const urlProperty =
          properties?.find((item) => item?.name?.escapedText === "url") || "";
        if (
          urlProperty &&
          !tsCompiler.isShorthandPropertyAssignment(urlProperty) &&
          urlProperty.initializer.text
        ) {
          // 情况 1-1 返回的 URL text 有值的情况
          realApiUrlList.push(urlProperty.initializer.text);
          return;
        } else if (
          urlProperty &&
          urlProperty.initializer &&
          tsCompiler.isTemplateExpression(urlProperty.initializer)
        ) {
          // 情况 1-2 返回的 URL text 无值的情况且节点类型为模板字面量
          realApiUrlList.push(urlProperty.initializer.head.text);
          return;
        } else if (
          urlProperty &&
          urlProperty.initializer &&
          tsCompiler.isPropertyAccessExpression(urlProperty.initializer)
        ) {
          const objectName = urlProperty.initializer.expression.escapedText;
          const propertyName = urlProperty.initializer.name.escapedText;
          if (objectName && propertyName) {
            realApiUrlList.push(analysisContext.crsApiMap[objectName][propertyName]);
          }
        }
        // 情况 2 url 定义在一个 Map 结构变量中
        const { declarationList } =
          statements.find((item) => tsCompiler.isVariableStatement(item)) || {};
        const { declarations = [] } = declarationList || {};
        // 取第一个元素
        const firstVariable = declarations[0];
        if (firstVariable && firstVariable.initializer?.properties) {
          firstVariable.initializer?.properties.forEach((element) => {
            if (element && element.initializer?.text) {
              realApiUrlList.push(element.initializer.text);
            }
          });
          return;
        }
        // 情况 3 return 一个 await 表达式
        /**
          export async function queryAgencyProjectConfig(params, hiddenToast, showErrorAlert) {
            return await request('/newHouse/inform/queryAgencyProjectConfig', {
              method: 'GET',
              params,
              hiddenToast,
              showErrorAlert
            })
          }
         */
        if (tsCompiler.isAwaitExpression(expression)) {
          const { expression: childrenExpression } = expression || {};
          const { text } =
            childrenExpression?.arguments?.find((item) =>
              tsCompiler.isStringLiteral(item)
            ) || {};
          realApiUrlList.push(text);
          return;
        }
        // 情况 4
        /**
          export function billConfigList(data) {
            return request('/propertyFinanceApi/finance/bill/config/list', {
              method: 'POST',
              data
            })
          }
         */
        const property =
          expression?.arguments?.find((item) =>
            tsCompiler.isStringLiteral(item)
          ) || {};
        if (property && property.text) {
          realApiUrlList.push(property.text);
          return;
        }
      }
    }
    walk(serviceAst);
    return realApiUrlList;
  }

  // 获取全局导入 Api 方式中，当前文件中具体使用的 api 列表
  function _findAllUseImportApi(ast, checker, pos, end) {
    const result = [];
    function walk(node) {
      tsCompiler.forEachChild(node, walk);

      const symbol = checker.getSymbolAtLocation(node);
      if (symbol && symbol.declarations && symbol.declarations.length > 0) {
        //存在声明
        const nodeSymbol = symbol.declarations[0];
        if (
          pos == nodeSymbol.pos &&
          end == nodeSymbol.end &&
          node.parent.name
        ) {
          /**
           * TODO 以下情况待处理
            const requestType = refundCode ? 'updateRefundBill' : 'addRefundBill'; // 编辑/新增接口
            const res = await refundApi[requestType](payload).finally(() => {
              this.submitLoading = false;
            });
           */
          // 语义上下文声明与从Import导入的API一致, 属于导入API声明
          result.push(node.parent.name.escapedText);
        }
      }
    }

    walk(ast);
    return result;
  }

  // 生成当前组件中所调用 API 的集合
  function _generateComponectApiList(ast, checker, componentFilePath) {
    function walk(node) {
      tsCompiler.forEachChild(node, walk);
      const apiReg = /(?:^|\/)api|request(?:\/|$|\.(js|ts)$)/g;
      if (
        node &&
        tsCompiler.isImportDeclaration(node) &&
        node.moduleSpecifier &&
        node.moduleSpecifier.text &&
        apiReg.test(node.moduleSpecifier.text)
      ) {
        let apiMethodNameList = [];
        if (node.importClause.namedBindings) {
          // 局部导入场景，包含as
          if (tsCompiler.isNamedImports(node.importClause.namedBindings)) {
            if (
              node.importClause.namedBindings.elements &&
              node.importClause.namedBindings.elements.length > 0
            ) {
              const tempArr = node.importClause.namedBindings.elements;
              tempArr.forEach((element) => {
                if (tsCompiler.isImportSpecifier(element)) {
                  // 记录API相关信息
                  apiMethodNameList.push(element.name.escapedText);
                }
              });
            }
          }
          // * 全量导入as场景
          if (
            tsCompiler.isNamespaceImport(node.importClause.namedBindings) &&
            node.importClause.namedBindings.name
          ) {
            // 获取当前 api 的 symbol 信息
            const symbol = checker.getSymbolAtLocation(
              node.importClause.namedBindings.name
            );
            if (
              symbol &&
              symbol.declarations &&
              symbol.declarations.length > 0
            ) {
              //存在声明
              const { pos, end } = symbol.declarations[0];
              // 记录API相关信息
              apiMethodNameList = _findAllUseImportApi(ast, checker, pos, end);
            }
          }
        }
        currentComponentApiList.push(
          ..._findRealApiByMethodName(
            apiMethodNameList,
            node.moduleSpecifier.text,
            componentFilePath
          )
        );
      }
    }
    walk(ast);
  }

  function generateComponentApiMap(context) {
    const { _scanFileAbsolutePath, createProgram } = context;
    if (_scanFileAbsolutePath.includes("crs-fe-pc")) {
      _generateCrsApiMap();
    }
    const componentFiles = glob.sync(`${_scanFileAbsolutePath}/src/**/*.vue`);
    const { program: componentProgram, realFilePathTmpTsFilePathMap } =
      createProgram(componentFiles, true);
    componentFiles.forEach((fileName) => {
      const componentAst = componentProgram.getSourceFile(
        realFilePathTmpTsFilePathMap[fileName]
      );
      const componentChecker = componentProgram.getTypeChecker();
      _generateComponectApiList(componentAst, componentChecker, fileName);
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
