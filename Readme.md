## 项目使用
一个使用 AST 来静态分析前端页面路由与该路由下调用接口集合的关系，结果形如：
```
  "/w/specialOrder": {
    "name": "专项工单管理",
    "apiList": [
      "/a/common/enum/list",
      "/a/role/getSpecialTaskRoles",
      ...
    ]
  },
```
同时会生成该 Json 的excel。
使用步骤：
1. 在终端进入要分析的项目，输入 pwd，找到项目的绝对路径；
2. 在终端进入本项目，npm i
3. 执行脚本
```
sh execute.sh [path] [type]
# path 为待分析项目的绝对路径
# type 为待分析的类型，枚举为 react vue
```
4. 即可得到三个阶段的产物
  a. componentApiMap.json	组件与 API 的对应关系
  b. componentTree.json		组件之间的相互引用关系树
  c. routerApiMap.json		路由与 API 的对应关系
根据分析经验，本项目不具备普适性，仅限于针对某几类结构相似的项目去进行分析，但整个分析范式是确定的，在使用本项目时，可以根据各自的项目进行调整，全局搜索 special 可以进行调整。

项目设计思路
有关如何拿到文件的 AST 需要使用到这个在线工具：https://astexplorer.net/
针对「路由 API 关系分析」这一问题，总结出以下解决范式：
Step 1：生成组件与 API 的对应关系
Step 2：生成组件之间的相互引用关系树
Step 3：生成路由与 API 的对应关系

包含了流程图的链接为：https://www.yuque.com/manzhifenjie/az7sda/spvdzrfutfn4u4nw?singleDoc# 《路由 Api 关系分析工具》
### Step 1：生成组件与 API 的对应关系
- 使用了 umi 全家桶的 react 项目，在组件中是使用 model 的 effects 来处理接口的调用，因此需要做一下转换，首先得到 namespace 与 component 的关系，然后找到 namespace 与真实 api 的关系，最后得出component 与 api 的关系；
- 使用了 axios 的 vue 项目，一般会把真实的 api 定义在一个 service.js 的文件中，所以就可以直接分析得到 component 与 api 的关系。

### Step 2：生成组件之间的相互引用关系树
本步骤由于 react 与 vue 获取 ast 的方法不同，故拆成两个文件，本质处理逻辑相同

### Step 3：生成路由与 API 的对应关系


## 项目结构
不同的项目需要对 step 1 与 step3 的代码进行调整，包括但不限于：
- 路由存放目录
- 项目名称（Todo 待优化）
- dispatch 的定义结构
- service 的定义结构
- router 的定义结构
```
.
├── execute.sh	// 执行脚本
├── getAnalysisPluginMap.js		// react 与 vue 分析插件 Map
├── lib	// 工具库
│   ├── analysis.js	// 分析工具类（主要）
│   ├── constant.js	// 常量
│   ├── file.js			// 文件工具
│   └── parse.js		// 生成 AST 工具函数
├── main.js					// 入口函数
├── package-lock.json
├── package.json
├── plugins					// 分析插件
│   ├── generateComponentApiMap_react		// step 1
│   │   ├── index.js
│   │   └── plugins
│   │       ├── generateComponentApiMap.js
│   │       └── generateNamespacePathMap.js
│   ├── generateComponentApiMap_vue			// step 1
│   │   ├── index.js
│   │   └── plugins
│   │       └── generateComponentApiMap.js
│   ├── generateRouterApiMap_react			// step 3
│   │   ├── index.js
│   │   └── plugins
│   │       ├── generateRouterApiMap.js
│   │       └── jsonToExcel.js
│   ├── generateRouterApiMap_vue				// step 3
│   │   ├── index.js
│   │   └── plugins
│   │       ├── generateRouterApiMap.js
│   │       └── jsonToExcel.js
│   ├── generateSourceMapTree_react			// step 2
│   │   ├── index.js
│   │   └── plugins
│   │       └── generateSourceMapTree.js
│   └── generateSourceMapTree_vue				// step 2
│       ├── index.js
│       └── plugins
│           └── generateSourceMapTree.js
└── vue_temp_ts_dir		// 生成 vue Ast 所需的临时代码片段存放目录
```
