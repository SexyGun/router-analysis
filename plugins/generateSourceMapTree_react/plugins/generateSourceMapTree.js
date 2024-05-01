const path = require("path"); // 路径操作
const tsCompiler = require("typescript"); // TS编译器

exports.generateSourceMapTree = function (analysisContext) {
  const mapName = "componentTree";
  // 在分析实例上下文挂载副作用
  analysisContext[mapName] = {};

  let currentChildrenPath = []; // 当前节点子路径

  // 分析import导入，分析导入时，不仅要仅要记录当前节点的引入关系，节点中还要记录引用了哪些API，以及API的引用路径
  function _findImportItems(ast, componentPath) {
    // 初始化当前子路径
    currentChildrenPath = [];
    // 记录导入的API及相关信息
    function dealImports(importPath, importApis) {
      // 第一步：生成绝对路径
      let absolateComponentPath = path.resolve(
        path.dirname(componentPath),
        importPath
      );
      // 第二步：转译绝对路径
      absolateComponentPath = absolateComponentPath.includes("@")
        ? absolateComponentPath.replace(/src(.*?)\/@/, "src")
        : absolateComponentPath;

      // 第三步：补充引用情况，并记录
      if (analysisContext.componentApiMap[absolateComponentPath]) {
        currentChildrenPath.push({
          path: absolateComponentPath,
          importApis,
        });
      } else if (
        analysisContext.componentApiMap[`${absolateComponentPath}.js`]
      ) {
        currentChildrenPath.push({
          path: `${absolateComponentPath}.js`,
          importApis,
        });
      } else if (
        analysisContext.componentApiMap[`${absolateComponentPath}.jsx`]
      ) {
        currentChildrenPath.push({
          path: `${absolateComponentPath}.jsx`,
          importApis,
        });
      } else if (
        analysisContext.componentApiMap[`${absolateComponentPath}/index.jsx`]
      ) {
        currentChildrenPath.push({
          path: `${absolateComponentPath}/index.jsx`,
          importApis,
        });
      } else if (
        analysisContext.componentApiMap[`${absolateComponentPath}/index.js`]
      ) {
        currentChildrenPath.push({
          path: `${absolateComponentPath}/index.js`,
          importApis,
        });
      }
    }
    // 初始化当前子路径
    // 遍历AST寻找import节点
    function walk(node) {
      tsCompiler.forEachChild(node, walk);

      // 分析导入情况
      if (node && tsCompiler.isImportDeclaration(node)) {
        // 命中target
        if (node.moduleSpecifier && node.moduleSpecifier.text) {
          // 存在导入项
          if (node.importClause) {
            // default直接导入场景
            if (node.importClause.name) {
              let temp = {
                name: node.importClause.name.escapedText,
                origin: null,
                symbolPos: node.importClause.pos,
                symbolEnd: node.importClause.end,
                identifierPos: node.importClause.name.pos,
                identifierEnd: node.importClause.name.end,
              };
              dealImports(node.moduleSpecifier.text, [temp]);
            }
            if (node.importClause.namedBindings) {
              // 拓展导入场景，包含as情况
              if (tsCompiler.isNamedImports(node.importClause.namedBindings)) {
                if (
                  node.importClause.namedBindings.elements &&
                  node.importClause.namedBindings.elements.length > 0
                ) {
                  const tempArr = node.importClause.namedBindings.elements;
                  const importApi = tempArr.map((element) => {
                    if (tsCompiler.isImportSpecifier(element)) {
                      let temp = {
                        name: element.name.escapedText,
                        origin: element.propertyName
                          ? element.propertyName.escapedText
                          : null,
                        symbolPos: element.pos,
                        symbolEnd: element.end,
                        identifierPos: element.name.pos,
                        identifierEnd: element.name.end,
                      };
                      return temp;
                    }
                  });
                  dealImports(node.moduleSpecifier.text, importApi);
                }
              }
              // * 全量导入as场景
              if (
                tsCompiler.isNamespaceImport(node.importClause.namedBindings) &&
                node.importClause.namedBindings.name
              ) {
                let temp = {
                  name: node.importClause.namedBindings.name.escapedText,
                  origin: "*",
                  symbolPos: node.importClause.namedBindings.pos,
                  symbolEnd: node.importClause.namedBindings.end,
                  identifierPos: node.importClause.namedBindings.name.pos,
                  identifierEnd: node.importClause.namedBindings.name.end,
                };
                dealImports(node.moduleSpecifier.text, [temp]);
              }
            }
          }
        }
      }
    }
    walk(ast);
  }

  // 递归生成树函数
  function _buildTree(items, componentProgram, parentPath) {
    const tree = [];
    const { _scanFileAbsolutePath } = analysisContext;
    // 黑名单中的组件存在循环调用的情况
    const BLACK_LIST = [
      `${_scanFileAbsolutePath}/src/components/Authorized/index.jsx`,
      `${_scanFileAbsolutePath}/src/components/Authorized/Secured.jsx`,
      `${_scanFileAbsolutePath}/src/components/Authorized/CheckPermissions.jsx`,
      `${_scanFileAbsolutePath}/src/components/Authorized/PromiseRender.jsx`,
    ];
    for (const item of items) {
      // 使用字面量赋值，避免都引用到最后一个数据
      const pathItem = { ...item };
      const componentAst = componentProgram.getSourceFile(item.path);
      _findImportItems(componentAst, item.path);
      const hasParent = currentChildrenPath.some(
        (childrenItem) => childrenItem.path === parentPath
      );
      const isBlack = BLACK_LIST.includes(item.path);
      if (currentChildrenPath.length && !hasParent && !isBlack) {
        const children = _buildTree(
          currentChildrenPath,
          componentProgram,
          item.path
        );
        if (children.length) {
          pathItem.children = children;
        }
      }
      tree.push(pathItem);
    }
    return tree;
  }

  function generateSourceMapTree(context) {
    const { createProgram } = context;
    const allContainNamespaceComponentPath = Object.keys(
      context.componentApiMap
    ).filter(
      (item) => !/model.js|service.js|\/models\/|\/services\//.test(item)
    );
    const componentProgram = createProgram(
      allContainNamespaceComponentPath
    ).program;
    const componentTree = _buildTree(
      allContainNamespaceComponentPath.map((item) => ({
        path: item,
        importApi: [],
      })),
      componentProgram,
      ""
    );
    context.componentTree = componentTree;
    return false; // true: 插件执行成功, 继续执行后序插件; false 不执行后续插件
  }
  // 返回组件中所包含的 API Map componentTree
  return {
    mapName: mapName,
    checkFun: generateSourceMapTree,
    afterHook: null,
  };
};
