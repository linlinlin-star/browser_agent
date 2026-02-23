/**
 * Document Generator
 * 根据页面信息和用户指令生成 Excel 和 Word 文档
 */

class DocumentGenerator {
  constructor() {
    this.pageData = null;
    this.userInstructions = null;
  }

  /**
   * 设置页面数据
   * @param {Object} data - 从页面提取的数据
   */
  setPageData(data) {
    this.pageData = data;
  }

  /**
   * 设置用户指令
   * @param {string} instructions - 用户的生成指令
   */
  setUserInstructions(instructions) {
    this.userInstructions = instructions;
  }

  /**
   * 生成 Excel 文件
   * @param {Array} data - 表格数据
   * @param {string} filename - 文件名
   * @returns {Blob} Excel 文件 Blob
   */
  async generateExcel(data, filename = 'export.xlsx') {
    try {
      // 创建工作簿
      const workbook = {
        SheetNames: ['Sheet1'],
        Sheets: {}
      };

      // 将数据转换为工作表
      const worksheet = this.arrayToSheet(data);
      workbook.Sheets['Sheet1'] = worksheet;

      // 生成 CSV 文件（简化版）
      const csvBuffer = this.writeWorkbook(workbook);
      const blob = new Blob([csvBuffer], { 
        type: 'text/csv;charset=utf-8;' 
      });

      return blob;
    } catch (error) {
      console.error('[DocumentGenerator] Excel 生成失败:', error);
      throw error;
    }
  }

  /**
   * 生成 Word 文档
   * @param {Object} content - 文档内容
   * @param {string} filename - 文件名
   * @returns {Blob} Word 文档 Blob
   */
  async generateWord(content, filename = 'document.docx') {
    try {
      // 创建文档结构
      const doc = {
        sections: [{
          properties: {},
          children: []
        }]
      };

      // 添加标题
      if (content.title) {
        doc.sections[0].children.push({
          type: 'paragraph',
          text: content.title,
          heading: 'Heading1'
        });
      }

      // 添加内容段落
      if (content.paragraphs && Array.isArray(content.paragraphs)) {
        content.paragraphs.forEach(para => {
          doc.sections[0].children.push({
            type: 'paragraph',
            text: para
          });
        });
      }

      // 添加表格
      if (content.tables && Array.isArray(content.tables)) {
        content.tables.forEach(table => {
          doc.sections[0].children.push({
            type: 'table',
            rows: table
          });
        });
      }

      // 生成 HTML 文件（简化版）
      const docBuffer = await this.createWordDocument(doc);
      const blob = new Blob([docBuffer], { 
        type: 'text/html;charset=utf-8;' 
      });

      return blob;
    } catch (error) {
      console.error('[DocumentGenerator] Word 生成失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   * @param {Blob} blob - 文件 Blob
   * @param {string} filename - 文件名
   * @returns {Object} 文件信息
   */
  downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // 返回文件信息供外部使用
    return {
      blob: blob,
      filename: filename,
      size: blob.size,
      type: blob.type
    };
  }

  /**
   * 将数组转换为工作表（简化版）
   * @param {Array} data - 数据数组
   * @returns {Object} 工作表对象
   */
  arrayToSheet(data) {
    const sheet = {};
    const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };

    for (let R = 0; R < data.length; ++R) {
      for (let C = 0; C < data[R].length; ++C) {
        if (range.e.c < C) range.e.c = C;
        if (range.e.r < R) range.e.r = R;

        const cell = { v: data[R][C] };
        const cellRef = this.encodeCellAddress({ c: C, r: R });
        
        if (cell.v == null) continue;
        
        sheet[cellRef] = cell;
      }
    }

    sheet['!ref'] = this.encodeRange(range);
    return sheet;
  }

  /**
   * 编码单元格地址
   * @param {Object} cell - 单元格坐标 {c, r}
   * @returns {string} 单元格地址 (如 "A1")
   */
  encodeCellAddress(cell) {
    const col = this.encodeCol(cell.c);
    const row = this.encodeRow(cell.r);
    return col + row;
  }

  /**
   * 编码列号
   * @param {number} c - 列索引
   * @returns {string} 列字母
   */
  encodeCol(c) {
    let s = '';
    for (++c; c; c = Math.floor((c - 1) / 26)) {
      s = String.fromCharCode(((c - 1) % 26) + 65) + s;
    }
    return s;
  }

  /**
   * 编码行号
   * @param {number} r - 行索引
   * @returns {string} 行号
   */
  encodeRow(r) {
    return String(r + 1);
  }

  /**
   * 编码范围
   * @param {Object} range - 范围对象
   * @returns {string} 范围字符串
   */
  encodeRange(range) {
    return this.encodeCellAddress(range.s) + ':' + this.encodeCellAddress(range.e);
  }

  /**
   * 写入工作簿（使用 CSV 格式作为简化实现）
   * @param {Object} workbook - 工作簿对象
   * @returns {ArrayBuffer} Excel 文件缓冲区
   */
  writeWorkbook(workbook) {
    // 简化实现：生成 CSV 格式
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = this.decodeRange(sheet['!ref']);
    
    let csv = '';
    for (let R = range.s.r; R <= range.e.r; ++R) {
      let row = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = this.encodeCellAddress({ c: C, r: R });
        const cell = sheet[cellAddress];
        let value = cell ? String(cell.v) : '';
        
        // CSV 转义：如果值包含逗号、引号或换行符，需要用引号包裹
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          // 引号需要转义为两个引号
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        row.push(value);
      }
      csv += row.join(',') + '\r\n'; // 使用 \r\n 作为行分隔符（Windows 标准）
    }
    
    // 添加 BOM 以支持中文（UTF-8 with BOM）
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csv);
    
    // 合并 BOM 和 CSV 内容
    const result = new Uint8Array(bom.length + csvBytes.length);
    result.set(bom, 0);
    result.set(csvBytes, bom.length);
    
    return result.buffer;
  }

  /**
   * 解码范围字符串
   * @param {string} range - 范围字符串 (如 "A1:C3")
   * @returns {Object} 范围对象
   */
  decodeRange(range) {
    const parts = range.split(':');
    return {
      s: this.decodeCellAddress(parts[0]),
      e: this.decodeCellAddress(parts[1])
    };
  }

  /**
   * 解码单元格地址
   * @param {string} address - 单元格地址 (如 "A1")
   * @returns {Object} 单元格坐标 {c, r}
   */
  decodeCellAddress(address) {
    const match = address.match(/^([A-Z]+)(\d+)$/);
    if (!match) return { c: 0, r: 0 };
    
    const col = match[1];
    const row = parseInt(match[2]);
    
    let c = 0;
    for (let i = 0; i < col.length; i++) {
      c = c * 26 + (col.charCodeAt(i) - 64);
    }
    
    return { c: c - 1, r: row - 1 };
  }

  /**
   * 创建 Word 文档（使用简化的 HTML 格式）
   * @param {Object} doc - 文档对象
   * @returns {Promise<ArrayBuffer>} Word 文件缓冲区
   */
  async createWordDocument(doc) {
    // 简化实现：生成 HTML 格式的文档
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Document</title></head><body>';
    
    const section = doc.sections[0];
    
    for (const child of section.children) {
      if (child.type === 'paragraph') {
        if (child.heading === 'Heading1') {
          html += `<h1>${child.text}</h1>`;
        } else {
          html += `<p>${child.text}</p>`;
        }
      } else if (child.type === 'table') {
        html += '<table border="1" style="border-collapse: collapse; width: 100%;">';
        for (const row of child.rows) {
          html += '<tr>';
          for (const cell of row) {
            html += `<td style="padding: 8px;">${cell}</td>`;
          }
          html += '</tr>';
        }
        html += '</table>';
      }
    }
    
    html += '</body></html>';
    
    // 转换为 ArrayBuffer
    const encoder = new TextEncoder();
    return encoder.encode(html).buffer;
  }

  /**
   * 从页面数据生成文档
   * @param {string} type - 文档类型 ('excel' 或 'word')
   * @param {string} filename - 文件名
   * @returns {Object} 生成结果
   */
  async generateFromPageData(type, filename) {
    if (!this.pageData) {
      throw new Error('未设置页面数据');
    }

    if (!this.userInstructions) {
      throw new Error('未设置用户指令');
    }

    try {
      let blob;
      let data;
      
      if (type === 'excel') {
        // 将页面数据转换为表格格式
        data = this.convertToTableData(this.pageData);
        blob = await this.generateExcel(data, filename);
      } else if (type === 'word') {
        // 将页面数据转换为文档格式
        const docContent = this.convertToDocContent(this.pageData);
        blob = await this.generateWord(docContent, filename);
        data = docContent;
      } else {
        throw new Error('不支持的文档类型');
      }

      const fileInfo = this.downloadFile(blob, filename);
      
      // 触发事件通知文件已生成
      if (typeof window !== 'undefined' && window.onDocumentGenerated) {
        window.onDocumentGenerated(filename, type, data, blob);
      }
      
      return {
        success: true,
        filename: filename,
        type: type,
        data: data,
        blob: blob,
        size: fileInfo.size
      };
    } catch (error) {
      console.error('[DocumentGenerator] 文档生成失败:', error);
      throw error;
    }
  }

  /**
   * 将页面数据转换为表格数据
   * @param {Object} pageData - 页面数据
   * @returns {Array} 表格数据
   */
  convertToTableData(pageData) {
    // 根据用户指令和页面数据生成表格
    const data = [];
    
    // 示例：如果页面数据包含列表
    if (pageData.items && Array.isArray(pageData.items)) {
      if (pageData.items.length === 0) {
        return data;
      }
      
      // 添加表头
      const headers = Object.keys(pageData.items[0] || {});
      if (headers.length > 0) {
        data.push(headers);
        
        // 添加数据行
        pageData.items.forEach(item => {
          const row = headers.map(header => {
            const value = item[header];
            // 确保值是字符串或数字，避免对象或数组
            if (value === null || value === undefined) {
              return '';
            }
            if (typeof value === 'object') {
              return JSON.stringify(value);
            }
            return String(value);
          });
          data.push(row);
        });
      }
    }
    
    return data;
  }

  /**
   * 将页面数据转换为文档内容
   * @param {Object} pageData - 页面数据
   * @returns {Object} 文档内容
   */
  convertToDocContent(pageData) {
    const content = {
      title: pageData.title || '文档标题',
      paragraphs: [],
      tables: []
    };

    // 添加描述段落
    if (pageData.description) {
      content.paragraphs.push(pageData.description);
    }

    // 添加内容段落
    if (pageData.content) {
      content.paragraphs.push(pageData.content);
    }

    // 如果有表格数据，添加到文档
    if (pageData.items && Array.isArray(pageData.items)) {
      const tableData = this.convertToTableData(pageData);
      content.tables.push(tableData);
    }

    return content;
  }
}

// 导出单例
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DocumentGenerator;
}
