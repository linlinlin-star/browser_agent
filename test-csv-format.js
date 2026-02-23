/**
 * CSV 格式测试 - 验证生成的 CSV 文件格式正确
 */

// 模拟浏览器环境
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.type = options?.type || '';
  }
};

const DocumentGenerator = require('./chrome-extension/document-generator.js');

async function testCSVFormat() {
  console.log('🧪 测试 CSV 格式...\n');

  const generator = new DocumentGenerator();

  // 测试数据 - 包含特殊字符
  const testData = {
    items: [
      { 
        "名称": "探秘\"莆田鞋\"", 
        "播放量": "19.1万", 
        "点赞量": "2,185",
        "时长": "23:05",
        "UP主": "王师傅の日记",
        "发布时间": "01-21"
      },
      { 
        "名称": "一人游︱印象之外，它或许是最被低估的古建宝藏城市！︱莆田", 
        "播放量": "6.6万", 
        "点赞量": "311",
        "时长": "19:45",
        "UP主": "诺曼顶教授",
        "发布时间": "2025-07-27"
      },
      { 
        "名称": "真 假 莆 田 鞋", 
        "播放量": "33.2万", 
        "点赞量": "4,036",
        "时长": "22:01",
        "UP主": "林海音Haiyin",
        "发布时间": "2025-02-28"
      }
    ]
  };

  generator.setPageData(testData);
  generator.setUserInstructions("生成视频列表");

  // 生成 CSV
  const tableData = generator.convertToTableData(testData);
  console.log('📊 表格数据:');
  console.log(JSON.stringify(tableData, null, 2));
  console.log('');

  const blob = await generator.generateExcel(tableData, 'test.csv');
  
  // 解码 CSV 内容
  const decoder = new TextDecoder('utf-8');
  const csvContent = decoder.decode(blob.parts[0]);
  
  console.log('📄 生成的 CSV 内容:');
  console.log('---开始---');
  console.log(csvContent);
  console.log('---结束---');
  console.log('');

  // 验证 CSV 格式
  const lines = csvContent.trim().split('\r\n');
  console.log(`✅ 总行数: ${lines.length} (期望: 4 - 1个表头 + 3个数据行)`);
  
  // 验证表头
  const headers = lines[0].split(',');
  console.log(`✅ 列数: ${headers.length} (期望: 6)`);
  console.log(`✅ 表头: ${headers.join(' | ')}`);
  console.log('');

  // 验证每一行的列数
  console.log('📋 验证每行数据:');
  lines.forEach((line, index) => {
    // 简单的 CSV 解析（处理引号）
    const columns = parseCSVLine(line);
    console.log(`  行 ${index + 1}: ${columns.length} 列`);
    if (index > 0) {
      console.log(`    名称: ${columns[0]}`);
      console.log(`    播放量: ${columns[1]}`);
      console.log(`    点赞量: ${columns[2]}`);
    }
  });
  console.log('');

  // 检查 BOM
  const hasUTF8BOM = blob.parts[0][0] === 0xEF && 
                     blob.parts[0][1] === 0xBB && 
                     blob.parts[0][2] === 0xBF;
  console.log(`✅ UTF-8 BOM: ${hasUTF8BOM ? '存在' : '不存在'} (期望: 存在)`);
  console.log('');

  console.log('🎉 CSV 格式测试完成！');
}

/**
 * 简单的 CSV 行解析器（处理引号）
 */
function parseCSVLine(line) {
  const columns = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 转义的引号
        current += '"';
        i++; // 跳过下一个引号
      } else {
        // 切换引号状态
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // 列分隔符
      columns.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // 添加最后一列
  columns.push(current);
  
  return columns;
}

// 运行测试
testCSVFormat().catch(console.error);
