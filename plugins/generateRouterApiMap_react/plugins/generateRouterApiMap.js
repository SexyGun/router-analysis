const path = require("path"); // 路径操作
const glob = require("glob");
const tsCompiler = require("typescript"); // TS编译器

exports.generateRouterApiMap = function (analysisContext) {
  const mapName = "routerApiMap";
  // 在分析实例上下文挂载副作用
  analysisContext[mapName] = {};

  // 广度优先遍历树
  function _breadthFirstSearch(tree, targetPath, callback) {
    const queue = [...tree];
    const hitNodes = [];

    while (queue.length > 0) {
      const currentNode = queue.shift();
      // 判断是否命中目标节点
      if (currentNode.path === targetPath) {
        // 使用递归获取该节点及其下的所有子节点
        const getAllChildren = (node) => {
          hitNodes.push(node);
          if (node.children && node.children.length > 0) {
            for (const childNode of node.children) {
              getAllChildren(childNode);
            }
          }
        };

        getAllChildren(currentNode);
        break; // 直接结束遍历
      }

      // 将子节点加入队列
      if (currentNode.children && currentNode.children.length > 0) {
        queue.push(...currentNode.children);
      }
    }
    // 调用回调函数处理命中的节点及其子节点
    callback(hitNodes);
  }

  function _executeGenerateRouterApiMap(ast, route) {
    // 处理命中路由引入的组件
    function handleRouteComponent(
      absolateComponentPath,
      routeName,
      routerPath
    ) {
      const { _scanFileAbsolutePath } = analysisContext;
      // 需要特殊处理的文件以及API
      const SEPCIAL_CONFIG = {
        filePath: `${_scanFileAbsolutePath}/src/utils/utils.js`,
        apiList: ["checkLogoutProject", "checkCanAdvanceProject"],
      };
      let targetNodeApiList = [];
      targetNodeApiList =
        analysisContext.componentApiMap[absolateComponentPath];
      // 找到路由文件及其子树下的所有 api
      _breadthFirstSearch(
        analysisContext.componentTree,
        absolateComponentPath,
        (hitNodes) => {
          // 快速遍历
          for (const hitnode of hitNodes) {
            const tempArr = analysisContext.componentApiMap[hitnode.path] || [];
            const { filePath, apiList } = SEPCIAL_CONFIG;
            if (hitnode.path === filePath) {
              if (
                hitnode.importApis.some((importApi) =>
                  apiList.includes(importApi.name)
                )
              ) {
                targetNodeApiList.push(...tempArr);
              }
            } else {
              targetNodeApiList.push(...tempArr);
            }
          }
        }
      );
      analysisContext.routerApiMap[routerPath] = {
        name: routeName,
        apiList: Array.from(new Set(targetNodeApiList)),
      };
    }
    function walk(node) {
      tsCompiler.forEachChild(node, walk);

      if (
        tsCompiler.isObjectLiteralExpression(node) &&
        node.properties &&
        node.properties.length === 3
      ) {
        const name =
          node.properties.find((item) => item.name.escapedText === "name")
            ?.initializer.text || "";
        const routerPath =
          node.properties.find((item) => item.name.escapedText === "path")
            ?.initializer.text || "";
        const componentPath =
          node.properties.find((item) => item.name.escapedText === "component")
            ?.initializer.text || "";
        let absolateComponentPath = "";
        if (componentPath) {
          absolateComponentPath = path.resolve(
            path.dirname(route),
            componentPath
          );
        }
        // special 针对特定项目的特殊处理
        const _absolateComponentPath = absolateComponentPath.replace(
          "fe-core/config/router",
          "fe-core/src/pages"
        ); 
        if (analysisContext.componentApiMap[_absolateComponentPath]) {
          handleRouteComponent(_absolateComponentPath, name, routerPath);
        } else if (
          analysisContext.componentApiMap[`${_absolateComponentPath}.js`]
        ) {
          handleRouteComponent(
            `${_absolateComponentPath}.js`,
            name,
            routerPath
          );
        } else if (
          analysisContext.componentApiMap[`${_absolateComponentPath}.jsx`]
        ) {
          handleRouteComponent(
            `${_absolateComponentPath}.jsx`,
            name,
            routerPath
          );
        } else if (
          analysisContext.componentApiMap[`${_absolateComponentPath}/index.jsx`]
        ) {
          handleRouteComponent(
            `${_absolateComponentPath}/index.jsx`,
            name,
            routerPath
          );
        } else if (
          analysisContext.componentApiMap[`${_absolateComponentPath}/index.js`]
        ) {
          handleRouteComponent(
            `${_absolateComponentPath}/index.js`,
            name,
            routerPath
          );
        }
      }
    }

    walk(ast);
  }

  function generateRouterApiMap(context) {
    const { _scanFileAbsolutePath, createProgram } = context;
    // special 获取所有路由文件（根据自己的项目来进行配置）
    const routerFiles = glob.sync(
      `${_scanFileAbsolutePath}/config/router/*.js`
    );
    const routerProgram = createProgram(routerFiles).program;
    routerFiles.forEach((route) => {
      const routerAst = routerProgram.getSourceFile(route);
      _executeGenerateRouterApiMap(routerAst, route);
    });
    return true; // true: 插件执行成功, 继续执行后序插件; false 不执行后续插件
  }
  // 返回组件中所包含的 API Map componentApiMap
  return {
    mapName: mapName,
    checkFun: generateRouterApiMap,
    afterHook: null,
  };
};
