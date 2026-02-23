// 测试 BOM
const fs = require('fs');

// 模拟浏览器环境
global.TextEncoder = require('util').TextEncoder;
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
  }
};

const DocumentGenerator = require('./chrome-extension/document-generator.js');

async function testBOM() {
  const generator = new DocumentGenerator();
  
  const testData = {
    items: [
      { "名称": "测试", "数量": "100" }
    ]
  };
  
  const tableData = generator.convertToTableData(testData);
  const blob = await generator.generateExcel(tableData, 'test.csv');
  
  const buffer = Buffer.from(blob.parts[0]);
  
  console.log('前10个字节:', Array.from(buffer.slice(0, 10)).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
  console.log('');
  console.log('BOM 检查:');
  console.log('  第1字节:', '0x' + buffer[0].toString(16).toUpperCase(), buffer[0] === 0xEF ? '✅' : '❌');
  console.log('  第2字节:', '0x' + buffer[1].toString(16).toUpperCase(), buffer[1] === 0xBB ? '✅' : '❌');
  console.log('  第3字节:', '0x' + buffer[2].toString(16).toUpperCase(), buffer[2] === 0xBF ? '✅' : '❌');
  
  // 保存文件测试
  fs.writeFileSync('test-output.csv', buffer);
  console.log('\n✅ 文件已保存为 test-output.csv，可以用 Excel 打开测试');
}

testBOM().catch(console.error);
