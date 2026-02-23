/**
 * File Manager
 * 管理生成的文档文件，支持预览和编辑
 */

class FileManager {
  constructor() {
    this.files = [];
    this.currentFile = null;
  }

  /**
   * 添加文件
   * @param {Object} fileInfo - 文件信息
   * @returns {string} 文件 ID
   */
  addFile(fileInfo) {
    const file = {
      id: this.generateId(),
      name: fileInfo.name || 'untitled',
      type: fileInfo.type || 'csv',
      data: fileInfo.data || [],
      blob: fileInfo.blob,
      createdAt: new Date().toISOString(),
      size: fileInfo.size || 0
    };

    this.files.push(file);
    this.saveToStorage();
    
    return file.id;
  }

  /**
   * 获取所有文件
   * @returns {Array} 文件列表
   */
  getFiles() {
    return this.files;
  }

  /**
   * 获取文件
   * @param {string} id - 文件 ID
   * @returns {Object} 文件对象
   */
  getFile(id) {
    return this.files.find(f => f.id === id);
  }

  /**
   * 更新文件数据
   * @param {string} id - 文件 ID
   * @param {Array} data - 新数据
   */
  updateFile(id, data) {
    const file = this.getFile(id);
    if (file) {
      file.data = data;
      file.updatedAt = new Date().toISOString();
      
      // 重新生成 blob
      if (file.type === 'csv') {
        file.blob = this.generateCSVBlob(data);
      } else if (file.type === 'html') {
        file.blob = this.generateHTMLBlob(data);
      }
      
      // 更新文件大小
      if (file.blob) {
        file.size = file.blob.size;
      }
      
      this.saveToStorage();
    }
  }

  /**
   * 重命名文件
   * @param {string} id - 文件 ID
   * @param {string} newName - 新文件名
   * @returns {boolean} 是否成功
   */
  renameFile(id, newName) {
    const file = this.getFile(id);
    if (file && newName && newName.trim()) {
      file.name = newName.trim();
      file.updatedAt = new Date().toISOString();
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * 复制文件
   * @param {string} id - 文件 ID
   * @returns {string} 新文件 ID
   */
  duplicateFile(id) {
    const file = this.getFile(id);
    if (!file) return null;
    
    const newFile = {
      id: this.generateId(),
      name: file.name.replace(/(\.[^.]+)$/, ' (副本)$1'),
      type: file.type,
      data: JSON.parse(JSON.stringify(file.data)), // 深拷贝
      blob: file.blob,
      createdAt: new Date().toISOString(),
      size: file.size
    };
    
    this.files.push(newFile);
    this.saveToStorage();
    
    return newFile.id;
  }

  /**
   * 批量删除文件
   * @param {Array<string>} ids - 文件 ID 数组
   * @returns {number} 删除的文件数量
   */
  deleteFiles(ids) {
    const initialLength = this.files.length;
    this.files = this.files.filter(f => !ids.includes(f.id));
    const deletedCount = initialLength - this.files.length;
    
    if (deletedCount > 0) {
      this.saveToStorage();
    }
    
    return deletedCount;
  }

  /**
   * 搜索文件
   * @param {string} query - 搜索关键词
   * @returns {Array} 匹配的文件列表
   */
  searchFiles(query) {
    if (!query || !query.trim()) {
      return this.files;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    return this.files.filter(f => 
      f.name.toLowerCase().includes(lowerQuery) ||
      f.type.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 按类型过滤文件
   * @param {string} type - 文件类型
   * @returns {Array} 匹配的文件列表
   */
  filterByType(type) {
    if (!type) {
      return this.files;
    }
    return this.files.filter(f => f.type === type);
  }

  /**
   * 获取文件统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = {
      totalFiles: this.files.length,
      totalSize: 0,
      byType: {}
    };
    
    this.files.forEach(f => {
      stats.totalSize += f.size || 0;
      
      if (!stats.byType[f.type]) {
        stats.byType[f.type] = {
          count: 0,
          size: 0
        };
      }
      
      stats.byType[f.type].count++;
      stats.byType[f.type].size += f.size || 0;
    });
    
    return stats;
  }

  /**
   * 删除文件
   * @param {string} id - 文件 ID
   */
  deleteFile(id) {
    this.files = this.files.filter(f => f.id !== id);
    this.saveToStorage();
  }

  /**
   * 生成文件 ID
   * @returns {string} 唯一 ID
   */
  generateId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 保存到本地存储
   */
  saveToStorage() {
    try {
      // 只保存文件元数据，不保存 blob
      const filesToSave = this.files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        data: f.data,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        size: f.size
      }));
      
      localStorage.setItem('fileManager_files', JSON.stringify(filesToSave));
    } catch (error) {
      console.error('[FileManager] 保存失败:', error);
    }
  }

  /**
   * 从本地存储加载
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('fileManager_files');
      if (saved) {
        this.files = JSON.parse(saved);
      }
    } catch (error) {
      console.error('[FileManager] 加载失败:', error);
      this.files = [];
    }
  }

  /**
   * 导出文件为 Blob
   * @param {string} id - 文件 ID
   * @returns {Blob} 文件 Blob
   */
  exportFile(id) {
    const file = this.getFile(id);
    if (!file) return null;

    if (file.blob) {
      return file.blob;
    }

    // 从数据重新生成 Blob
    if (file.type === 'csv') {
      return this.generateCSVBlob(file.data);
    } else if (file.type === 'html') {
      return this.generateHTMLBlob(file.data);
    }

    return null;
  }

  /**
   * 生成 CSV Blob
   * @param {Array} data - 表格数据
   * @returns {Blob} CSV Blob
   */
  generateCSVBlob(data) {
    let csv = '';
    
    for (let row of data) {
      const escapedRow = row.map(cell => {
        let value = String(cell || '');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      });
      csv += escapedRow.join(',') + '\r\n';
    }

    // 添加 BOM
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csv);
    
    const result = new Uint8Array(bom.length + csvBytes.length);
    result.set(bom, 0);
    result.set(csvBytes, bom.length);

    return new Blob([result], { type: 'text/csv;charset=utf-8;' });
  }

  /**
   * 生成 HTML Blob
   * @param {Array} data - 文档数据
   * @returns {Blob} HTML Blob
   */
  generateHTMLBlob(data) {
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Document</title></head><body>';
    
    // 简单的 HTML 生成
    for (let item of data) {
      if (item.paragraph) {
        html += `<p>${item.paragraph}</p>`;
      } else if (item.table) {
        html += '<table border="1">';
        for (let row of item.table) {
          html += '<tr>';
          for (let cell of row) {
            html += `<td>${cell}</td>`;
          }
          html += '</tr>';
        }
        html += '</table>';
      }
    }
    
    html += '</body></html>';

    return new Blob([html], { type: 'text/html;charset=utf-8;' });
  }

  /**
   * 下载文件
   * @param {string} id - 文件 ID
   */
  downloadFile(id) {
    const file = this.getFile(id);
    if (!file) return;

    const blob = this.exportFile(id);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 清空所有文件
   */
  clearAll() {
    this.files = [];
    this.currentFile = null;
    this.saveToStorage();
  }
}

// 导出单例
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileManager;
}
