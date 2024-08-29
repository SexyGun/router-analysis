const Excel = require("exceljs");

const PUBLIC_PATH = "";
const CONTENT_PATH = "hms";

exports.jsonToExcel = function (analysisContext) {
  async function jsonToExcel() {
    const { routerApiMap } = analysisContext;
    const routeEntries = Object.entries(routerApiMap);
    const routeArr = routeEntries.map((item) => {
      const [path, obj] = item || [];
      return {
        routePath: `${PUBLIC_PATH}${
          path.includes(CONTENT_PATH) ? "" : `/${CONTENT_PATH}`
        }${path}`,
        name: obj.name,
        apiList: obj.apiList
      };
    });
    // 创建工作簿
    let workbook = new Excel.Workbook();
    // 添加一个工作表
    let worksheet = workbook.addWorksheet("Sheet1");
    const jsonData = {
      columns: ["routePath", "name", "apiList"],
      rows: routeArr,
    };
    // 添加标题行
    worksheet.columns = jsonData.columns.map((column) => {
      return { header: column, key: column, width: 30 };
    });

    // 添加数据行
    jsonData.rows.forEach((row, index) => {
      worksheet.addRow(row).commit();
    });

    // 写入文件
    await workbook.xlsx.writeFile("routeArr.xlsx");
    console.log("Excel file routeArr.xlsx has been created!");
    return false; // true: 插件执行成功, 继续执行后序插件; false 不执行后续插件
  }
  // 返回组件中所包含的 API Map componentApiMap
  return {
    mapName: "",
    checkFun: jsonToExcel,
    afterHook: null,
  };
};
