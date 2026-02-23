# 文档生成器功能

## 功能概述

文档生成器允许用户根据页面提取的信息和自定义指令，自动生成 Excel 表格和 Word 文档。

## 主要特性

- ✅ 从网页提取数据并转换为结构化格式
- ✅ 根据用户指令生成 Excel 表格
- ✅ 根据用户指令生成 Word 文档
- ✅ 支持自定义文件名和格式
- ✅ 自动下载生成的文档

## 使用方法

### 1. 基本用法

```javascript
// 创建文档生成器实例
const generator = new DocumentGenerator();

// 设置页面数据
generator.setPageData({
  title: "产品列表",
  items: [
    { name: "产品A", price: 100, stock: 50 },
    { name: "产品B", price: 200, stock: 30 }
  ]
});

// 设置用户指令
generator.setUserInstructions("生成包含所有产品信息的表格");

// 生成 Excel 文件
await generator.generateFromPageData('excel', 'products.xlsx');

// 生成 Word 文档
await generator.generateFromPageData('word', 'products.docx');
```

### 2. 直接生成

```javascript
// 生成 Excel
const excelData = [
  ['姓名', '年龄', '城市'],
  ['张三', 25, '北京'],
  ['李四', 30, '上海']
];
const excelBlob = await generator.generateExcel(excelData, 'data.xlsx');
generator.downloadFile(excelBlob, 'data.xlsx');

// 生成 Word
const wordContent = {
  title: '报告标题',
  paragraphs: ['这是第一段', '这是第二段'],
  tables: [excelData]
};
const wordBlob = await generator.generateWord(wordContent, 'report.docx');
generator.downloadFile(wordBlob, 'report.docx');
```

## 数据格式

### 页面数据格式

```json
{
  "title": "文档标题",
  "description": "文档描述",
  "content": "主要内容",
  "items": [
    {
      "字段1": "值1",
      "字段2": "值2"
    }
  ]
}
```

### Excel 数据格式

```javascript
[
  ['表头1', '表头2', '表头3'],  // 第一行：表头
  ['数据1', '数据2', '数据3'],  // 数据行
  ['数据4', '数据5', '数据6']
]
```

### Word 内容格式

```javascript
{
  title: '文档标题',
  paragraphs: ['段落1', '段落2'],
  tables: [
    [
      ['单元格1', '单元格2'],
      ['单元格3', '单元格4']
    ]
  ]
}
```

## 集成到扩展

### 在 popup.js 中使用

```javascript
// 添加生成文档按钮的事件监听
document.getElementById('generate-excel-btn').addEventListener('click', async () => {
  try {
    // 获取当前页面数据
    const pageData = await extractPageData();
    
    // 获取用户指令
    const instructions = document.getElementById('instructions').value;
    
    // 生成文档
    const generator = new DocumentGenerator();
    generator.setPageData(pageData);
    generator.setUserInstructions(instructions);
    await generator.generateFromPageData('excel', 'export.xlsx');
    
    console.log('Excel 文件生成成功');
  } catch (error) {
    console.error('生成失败:', error);
  }
});
```

### 在 manifest.json 中添加权限

```json
{
  "permissions": [
    "downloads"
  ]
}
```

## 依赖库

需要安装以下 npm 包：

```bash
npm install xlsx docx
```

- `xlsx`: 用于生成 Excel 文件
- `docx`: 用于生成 Word 文档

## 测试

打开 `test-document-generator.html` 进行功能测试。

## 注意事项

1. 当前实现是基础版本，需要集成实际的 xlsx 和 docx 库
2. 生成的文件会自动下载到浏览器默认下载目录
3. 确保扩展有下载权限
4. 大文件生成可能需要较长时间

## 未来改进

- [ ] 支持更多 Excel 格式选项（样式、公式等）
- [ ] 支持更多 Word 格式选项（字体、颜色等）
- [ ] 支持 PDF 生成
- [ ] 支持模板功能
- [ ] 支持批量生成
- [ ] 添加进度提示
