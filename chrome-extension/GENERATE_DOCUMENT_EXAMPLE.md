# generateDocument Action 使用示例

## 功能说明

`generateDocument` action 允许 Agent 从提取的数据直接生成 Excel 或 Word 文档并自动下载。

## 使用场景

### 场景 1: 搜索结果导出到 Excel

**任务**: "在百度搜索'石河子'，提取前10条结果并生成 Excel 表格"

**Agent 执行流程**:

```javascript
// 1. 搜索
{"thought": "搜索石河子", "action": "search", "args": {"text": "石河子"}}

// 2. 等待加载
{"thought": "等待搜索结果加载", "action": "wait", "args": {"ms": 2000}}

// 3. 获取快照
{"thought": "获取搜索结果页面结构", "action": "snapshot", "args": {}}

// 4. 提取多个结果
{"thought": "提取前10条搜索结果", "action": "getText", "args": {"ref": "e1"}}
// ... 重复提取 e2, e3, ... e10

// 5. 整理数据并生成文档
{
  "thought": "已提取10条结果，现在生成 Excel 文档",
  "action": "generateDocument",
  "args": {
    "data": [
      {"序号": 1, "标题": "石河子市 - 百度百科", "链接": "..."},
      {"序号": 2, "标题": "石河子市人民政府", "链接": "..."},
      // ... 更多数据
    ],
    "type": "excel",
    "filename": "石河子搜索结果.csv"
  }
}

// 6. 完成任务
{"thought": "文档已生成并下载", "action": "finished", "args": {"result": "已生成包含10条搜索结果的 Excel 文件"}}
```

---

### 场景 2: B站视频信息导出

**任务**: "在B站搜索'莆田'，提取前5个视频的名称、播放量、点赞量，生成 Excel 表格"

**Agent 执行流程**:

```javascript
// 1. 导航到B站
{"thought": "打开B站", "action": "navigate", "args": {"url": "https://www.bilibili.com"}}

// 2. 搜索
{"thought": "搜索莆田", "action": "search", "args": {"text": "莆田"}}

// 3. 等待
{"thought": "等待搜索结果", "action": "wait", "args": {"ms": 2000}}

// 4. 获取快照
{"thought": "查看搜索结果", "action": "snapshot", "args": {}}

// 5. 提取视频信息
{"thought": "提取第一个视频信息", "action": "getText", "args": {"ref": "e5"}}
// ... 重复提取更多视频

// 6. 生成 Excel 文档
{
  "thought": "已提取5个视频信息，生成 Excel 表格",
  "action": "generateDocument",
  "args": {
    "data": [
      {
        "标题": "探秘"莆田鞋"",
        "播放量": "19.1万",
        "点赞量": "2185",
        "时长": "23:05",
        "UP主": "王师傅の日记"
      },
      // ... 更多视频
    ],
    "type": "excel",
    "filename": "莆田视频列表.csv"
  }
}

// 7. 完成
{"thought": "Excel 文件已生成", "action": "finished", "args": {"result": "已生成包含5个视频信息的 Excel 文件"}}
```

---

### 场景 3: 文章内容导出到 Word

**任务**: "打开某篇文章，提取标题和内容，生成 Word 文档"

**Agent 执行流程**:

```javascript
// 1. 导航到文章
{"thought": "打开文章页面", "action": "navigate", "args": {"url": "https://..."}}

// 2. 获取内容
{"thought": "提取文章内容", "action": "getMarkdown", "args": {}}

// 3. 生成 Word 文档
{
  "thought": "将文章内容生成 Word 文档",
  "action": "generateDocument",
  "args": {
    "data": [
      {"段落": "这是第一段内容..."},
      {"段落": "这是第二段内容..."}
    ],
    "type": "word",
    "filename": "文章内容.html"
  }
}

// 4. 完成
{"thought": "Word 文档已生成", "action": "finished", "args": {"result": "文章已导出为 Word 文档"}}
```

---

## 参数说明

### data (必需)
- 类型: Array of Objects
- 说明: 要导出的数据数组
- 格式: 每个对象的键将成为表格的列名

**示例**:
```javascript
[
  {"姓名": "张三", "年龄": 25, "城市": "北京"},
  {"姓名": "李四", "年龄": 30, "城市": "上海"}
]
```

### type (必需)
- 类型: String
- 可选值: `'excel'` 或 `'word'`
- 说明: 
  - `'excel'`: 生成 CSV 格式文件（可用 Excel 打开）
  - `'word'`: 生成 HTML 格式文件（可用 Word 打开）

### filename (可选)
- 类型: String
- 默认值: `'export.csv'` 或 `'document.html'`
- 说明: 下载文件的名称

---

## 数据格式要求

### Excel 格式
数据应该是对象数组，每个对象的键相同：

```javascript
{
  "data": [
    {"列1": "值1", "列2": "值2", "列3": "值3"},
    {"列1": "值4", "列2": "值5", "列3": "值6"}
  ],
  "type": "excel",
  "filename": "数据.csv"
}
```

生成的 CSV 文件：
```
列1,列2,列3
值1,值2,值3
值4,值5,值6
```

### Word 格式
数据可以包含段落和表格：

```javascript
{
  "data": [
    {"段落": "这是第一段"},
    {"段落": "这是第二段"},
    {"表格行": ["单元格1", "单元格2"]}
  ],
  "type": "word",
  "filename": "文档.html"
}
```

---

## 注意事项

1. **数据完整性**: 确保在调用 `generateDocument` 前已提取所有需要的数据
2. **数据格式**: 数据必须是数组格式，每个元素是一个对象
3. **文件下载**: 文件会自动下载到浏览器默认下载目录
4. **步骤预算**: 生成文档通常需要 1-2 步，确保有足够的步骤预算
5. **错误处理**: 如果生成失败，会返回错误信息

---

## 完整示例

### 示例任务
"在百度搜索'人工智能'，提取前3条结果的标题和链接，生成 Excel 表格"

### 完整执行流程

```javascript
// Step 1: 搜索
{
  "thought": "在百度搜索'人工智能'",
  "action": "search",
  "args": {"text": "人工智能"}
}

// Step 2: 等待
{
  "thought": "等待搜索结果加载",
  "action": "wait",
  "args": {"ms": 2000}
}

// Step 3: 快照
{
  "thought": "获取搜索结果页面结构",
  "action": "snapshot",
  "args": {}
}

// Step 4-6: 提取结果
{
  "thought": "提取第一条结果",
  "action": "getText",
  "args": {"ref": "e10"}
}
// 结果: "人工智能 - 百度百科"

{
  "thought": "提取第二条结果",
  "action": "getText",
  "args": {"ref": "e15"}
}
// 结果: "人工智能的发展历程"

{
  "thought": "提取第三条结果",
  "action": "getText",
  "args": {"ref": "e20"}
}
// 结果: "AI技术应用"

// Step 7: 生成文档
{
  "thought": "已提取3条结果，现在生成 Excel 文档",
  "action": "generateDocument",
  "args": {
    "data": [
      {
        "序号": 1,
        "标题": "人工智能 - 百度百科",
        "链接": "https://baike.baidu.com/..."
      },
      {
        "序号": 2,
        "标题": "人工智能的发展历程",
        "链接": "https://..."
      },
      {
        "序号": 3,
        "标题": "AI技术应用",
        "链接": "https://..."
      }
    ],
    "type": "excel",
    "filename": "人工智能搜索结果.csv"
  }
}

// Step 8: 完成
{
  "thought": "Excel 文件已生成并下载，任务完成",
  "action": "finished",
  "args": {
    "result": "已成功生成包含3条搜索结果的 Excel 文件：人工智能搜索结果.csv"
  }
}
```

---

## 故障排除

### 问题 1: 文档没有下载
- 检查浏览器下载设置
- 确保扩展有下载权限
- 查看浏览器控制台错误信息

### 问题 2: 数据格式错误
- 确保 data 是数组格式
- 检查每个对象的键是否一致
- 验证数据类型正确

### 问题 3: 文件内容为空
- 确认 data 数组不为空
- 检查数据提取是否成功
- 验证数据结构正确

---

## 最佳实践

1. **先提取后生成**: 完成所有数据提取后再调用 generateDocument
2. **数据验证**: 在生成前检查数据完整性
3. **有意义的文件名**: 使用描述性的文件名
4. **合理的数据量**: 避免一次性导出过多数据
5. **错误处理**: 检查 action 返回结果，处理可能的错误
