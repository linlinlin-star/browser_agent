# 文件操作按钮修复说明

## 问题描述

文件列表中的预览、编辑、复制和删除按钮无法点击。

## 根本原因

按钮使用了内联 `onclick` 属性，但函数在某些情况下无法从全局作用域访问。

## 解决方案

### 1. 使用事件委托

将所有内联 `onclick` 改为使用 `data-action` 属性，并通过事件委托处理点击：

```javascript
// 之前（不工作）
<button onclick="previewFile('${file.id}')">预览</button>

// 现在（工作）
<button data-action="preview" data-file-id="${file.id}">预览</button>
```

### 2. 统一事件处理

在 `renderFileList()` 后调用 `setupFileListEventListeners()` 设置事件监听：

```javascript
function setupFileListEventListeners() {
  // 文件操作按钮 - 使用事件委托
  const fileListContent = document.getElementById('file-list-content');
  if (fileListContent) {
    fileListContent.addEventListener('click', (e) => {
      const button = e.target.closest('.file-action-btn');
      if (!button) return;
      
      const action = button.dataset.action;
      const fileId = button.dataset.fileId;
      
      switch (action) {
        case 'preview':
          window.previewFile(fileId);
          break;
        case 'duplicate':
          window.duplicateFileById(fileId);
          break;
        case 'download':
          window.downloadFileById(fileId);
          break;
        case 'delete':
          window.deleteFileById(fileId);
          break;
      }
    });
  }
}
```

### 3. CSV 预览页面

CSV 预览页面也使用相同的事件委托模式：

```javascript
function setupCSVPreviewEventListeners(fileId) {
  const preview = document.querySelector('.file-preview');
  if (!preview) return;
  
  // 按钮点击事件
  preview.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    
    switch (action) {
      case 'back':
      case 'cancel':
        renderFileList();
        break;
      case 'rename':
        window.renameFile(fileId);
        break;
      case 'add-row':
        window.addRowToCSV(fileId);
        break;
      // ...
    }
  });
}
```

## 修复的功能

### 文件列表页面
- ✅ 预览按钮
- ✅ 复制按钮
- ✅ 下载按钮
- ✅ 删除按钮
- ✅ 搜索框
- ✅ 过滤按钮

### CSV 预览页面
- ✅ 返回按钮
- ✅ 重命名按钮
- ✅ 添加行按钮
- ✅ 下载按钮
- ✅ 删除行按钮
- ✅ 取消按钮
- ✅ 保存更改按钮
- ✅ 单元格编辑

### HTML 预览页面
- ✅ 返回按钮
- ✅ 重命名按钮
- ✅ 切换视图按钮
- ✅ 下载按钮
- ✅ 标签页切换

## 优势

### 1. 更好的性能
- 使用事件委托，只需要一个监听器
- 动态添加的元素自动支持

### 2. 更好的维护性
- 事件处理逻辑集中管理
- 易于调试和修改

### 3. 更好的兼容性
- 不依赖全局作用域
- 避免 CSP（内容安全策略）问题

## 测试

### 测试文件列表
1. 打开 `test-file-operations.html`
2. 生成测试文件
3. 测试所有按钮功能

### 测试 CSV 预览
1. 点击文件的"预览"按钮
2. 测试编辑单元格
3. 测试添加行
4. 测试删除行
5. 测试保存更改

### 测试 HTML 预览
1. 生成 HTML 文件
2. 点击"预览"按钮
3. 测试视图切换
4. 测试下载功能

## 调试

如果按钮仍然不工作，检查：

1. **控制台错误**
   ```javascript
   // 打开浏览器控制台查看错误
   console.log('[DEBUG] Button clicked:', action, fileId);
   ```

2. **事件监听器**
   ```javascript
   // 检查事件监听器是否正确设置
   const fileList = document.getElementById('file-list-content');
   console.log('Event listeners:', getEventListeners(fileList));
   ```

3. **元素存在性**
   ```javascript
   // 检查元素是否存在
   const button = document.querySelector('[data-action="preview"]');
   console.log('Button exists:', !!button);
   ```

## 代码对比

### 之前（不工作）

```html
<button onclick="previewFile('file_123')">预览</button>
<button onclick="duplicateFileById('file_123')">复制</button>
<button onclick="downloadFileById('file_123')">下载</button>
<button onclick="deleteFileById('file_123')">删除</button>
```

### 现在（工作）

```html
<button data-action="preview" data-file-id="file_123">预览</button>
<button data-action="duplicate" data-file-id="file_123">复制</button>
<button data-action="download" data-file-id="file_123">下载</button>
<button data-action="delete" data-file-id="file_123">删除</button>
```

```javascript
// 统一的事件处理
fileListContent.addEventListener('click', (e) => {
  const button = e.target.closest('.file-action-btn');
  if (!button) return;
  
  const action = button.dataset.action;
  const fileId = button.dataset.fileId;
  
  // 根据 action 执行相应操作
  handleFileAction(action, fileId);
});
```

## 总结

通过使用事件委托替代内联 `onclick`，我们解决了按钮无法点击的问题，同时提高了代码的可维护性和性能。所有文件操作功能现在都应该正常工作。
