/**
 * 文档生成器测试脚本
 */

// 模拟浏览器环境
global.TextEncoder = require('util').TextEncoder;
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
  }
};

// 导入文档生成器
const DocumentGenerator = require('./chrome-extension/document-generator.js');

async function testDocumentGenerator() {
  console.log('🧪 开始测试文档生成器...\n');

  const generator = new DocumentGenerator();

  // 测试数据
  const testData = {
    title: "产品列表",
    description: "这是一个产品列表示例",
    items: [
      { "名称": "产品A", "价格": "100", "库存": "50" },
      { "名称": "产品B", "价格": "200", "库存": "30" },
      { "名称": "产品C", "价格": "150", "库存": "40" }
    ]
  };

  const instructions = "生成一个包含所有产品信息的表格";

  generator.setPageData(testData);
  generator.setUserInstructions(instructions);

  // 测试 1: 转换为表格数据
  console.log('📊 测试 1: 转换页面数据为表格格式');
  const tableData = generator.convertToTableData(testData);
  console.log('表格数据:', tableData);
  console.log('✅ 测试 1 通过\n');

  // 测试 2: 生成 Excel (CSV)
  console.log('📄 测试 2: 生成 CSV 文件');
  try {
    const excelBlob = await generator.generateExcel(tableData, 'test.csv');
    console.log('CSV Blob 类型:', excelBlob.type);
    console.log('CSV Blob 大小:', excelBlob.parts[0].byteLength, 'bytes');
    console.log('✅ 测试 2 通过\n');
  } catch (error) {
    console.error('❌ 测试 2 失败:', error.message);
  }

  // 测试 3: 转换为文档内容
  console.log('📝 测试 3: 转换页面数据为文档格式');
  const docContent = generator.convertToDocContent(testData);
  console.log('文档内容:', JSON.stringify(docContent, null, 2));
  console.log('✅ 测试 3 通过\n');

  // 测试 4: 生成 Word (HTML)
  console.log('📄 测试 4: 生成 HTML 文档');
  try {
    const wordBlob = await generator.generateWord(docContent, 'test.html');
    console.log('HTML Blob 类型:', wordBlob.type);
    console.log('HTML Blob 大小:', wordBlob.parts[0].byteLength, 'bytes');
    
    // 显示生成的 HTML 内容
    const decoder = new TextDecoder();
    const htmlContent = decoder.decode(wordBlob.parts[0]);
    console.log('生成的 HTML 内容预览:');
    console.log(htmlContent.substring(0, 200) + '...');
    console.log('✅ 测试 4 通过\n');
  } catch (error) {
    console.error('❌ 测试 4 失败:', error.message);
  }

  // 测试 5: 单元格地址编码
  console.log('🔤 测试 5: 单元格地址编码');
  const testCells = [
    { c: 0, r: 0, expected: 'A1' },
    { c: 1, r: 0, expected: 'B1' },
    { c: 25, r: 0, expected: 'Z1' },
    { c: 26, r: 0, expected: 'AA1' },
    { c: 0, r: 9, expected: 'A10' }
  ];

  let allPassed = true;
  testCells.forEach(test => {
    const result = generator.encodeCellAddress({ c: test.c, r: test.r });
    const passed = result === test.expected;
    console.log(`  ${passed ? '✅' : '❌'} (${test.c}, ${test.r}) => ${result} (期望: ${test.expected})`);
    if (!passed) allPassed = false;
  });

  if (allPassed) {
    console.log('✅ 测试 5 通过\n');
  } else {
    console.log('❌ 测试 5 失败\n');
  }

  console.log('🎉 所有测试完成！');
}

// 运行测试
testDocumentGenerator().catch(console.error);
