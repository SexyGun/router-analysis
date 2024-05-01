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

  // 寻找模式 2 的组件地址
  function _findComponentPath(ast, target) {
    let result = "";
    function walk(node) {
      tsCompiler.forEachChild(node, walk);
      if (
        tsCompiler.isVariableDeclaration(node) &&
        node?.name?.escapedText === target
      ) {
        result = node.initializer?.body?.arguments[0].text;
      }
    }
    walk(ast);

    return result;
  }

  function _executeGenerateRouterApiMap(ast) {
    // 处理命中路由引入的组件
    function handleRouteComponent(
      absolateComponentPath,
      routeName,
      routerPath
    ) {
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
            targetNodeApiList.push(...tempArr);
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
        node.properties.length
      ) {
        // 路由名称
        const name =
          (
            node.properties.find((item) => item.name.escapedText === "meta")
              ?.initializer.properties || []
          ).find((item) => item.name.escapedText === "title")?.initializer
            .text ||
          node.properties.find((item) => item.name.escapedText === "name")
            ?.initializer.text ||
          "";
        // 路由 path
        const routerPath =
          (
            node.properties.find((item) => item.name.escapedText === "meta")
              ?.initializer.properties || []
          ).find((item) => item.name.escapedText === "activeMenu")?.initializer
            .text ||
          node.properties.find((item) => item.name.escapedText === "path")
            ?.initializer.text ||
          "";
        // 引用组件地址
        const componentNode = node.properties.find(
          (item) => item.name.escapedText === "component"
        );
        let componentPath = "";
        /**
         *         
          {
            path: 'service-standard',
            name: 'serviceStandard',
            component: () => import('@/pages/customerWorkOrder/serviceStandard'),
            meta: {
              title: '服务标准管理',
            },
          },
         */
        const modeOneUrl = (componentNode?.initializer.body?.arguments || [])[0]
          ?.text;
        /**
          const housesList = () => import('@/page/houses/list'); // 房源列表
            {
              path: '/sellHousesList_blank',
              component: housesList,
              name: 'sellHousesList',
              meta: {
                breadcrumb: [{ name: '出售房源', url: '/sellHousesList_blank' }],
              },
            },
         */
        const modeTwoUrlName = componentNode?.initializer.escapedText;
        if (modeOneUrl) {
          componentPath = modeOneUrl;
        }
        if (modeTwoUrlName) {
          componentPath = _findComponentPath(ast, modeTwoUrlName);
        }
        if (!componentPath) return;
        const { _scanFileAbsolutePath } = analysisContext;
        const _absolateComponentPath = componentPath.replace(
          "@",
          `${_scanFileAbsolutePath}/src`
        );
        if (analysisContext.componentApiMap[_absolateComponentPath]) {
          handleRouteComponent(_absolateComponentPath, name, routerPath);
        } else if (
          analysisContext.componentApiMap[`${_absolateComponentPath}.vue`]
        ) {
          handleRouteComponent(
            `${_absolateComponentPath}.vue`,
            name,
            routerPath
          );
        } else if (
          analysisContext.componentApiMap[`${_absolateComponentPath}/index.vue`]
        ) {
          handleRouteComponent(
            `${_absolateComponentPath}/index.vue`,
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
    const routerFiles = glob
      .sync(`${_scanFileAbsolutePath}/src/router/**/*.js`)
      .concat(glob.sync(`${_scanFileAbsolutePath}/src/router/**/*.ts`));
    const { program: routerProgram } = createProgram(routerFiles);
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
