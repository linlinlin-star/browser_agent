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

      // 生成 Excel 文件
      const excelBuffer = this.writeWorkbook(workbook);
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
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

      // 生成 Word 文件
      const docBuffer = await this.createWordDocument(doc);
      const blob = new Blob([docBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
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
   * 写入工作簿（简化版，实际需要使用 xlsx 库）
   * @param {Object} workbook - 工作簿对象
   * @returns {ArrayBuffer} Excel 文件缓冲区
   */
  writeWorkbook(workbook) {
    // 这里需要实际的 xlsx 库来生成文件
    // 暂时返回一个占位符
    console.warn('[DocumentGenerator] 需要集成 xlsx 库来生成实际的 Excel 文件');
    return new ArrayBuffer(0);
  }

  /**
   * 创建 Word 文档（简化版，实际需要使用 docx 库）
   * @param {Object} doc - 文档对象
   * @returns {Promise<ArrayBuffer>} Word 文件缓冲区
   */
  async createWordDocument(doc) {
    // 这里需要实际的 docx 库来生成文件
    // 暂时返回一个占位符
    console.warn('[DocumentGenerator] 需要集成 docx 库来生成实际的 Word 文件');
    return new ArrayBuffer(0);
  }

  /**
   * 从页面数据生成文档
   * @param {string} type - 文档类型 ('excel' 或 'word')
   * @param {string} filename - 文件名
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
      
      if (type === 'excel') {
        // 将页面数据转换为表格格式
        const tableData = this.convertToTableData(this.pageData);
        blob = await this.generateExcel(tableData, filename);
      } else if (type === 'word') {
        // 将页面数据转换为文档格式
        const docContent = this.convertToDocContent(this.pageData);
        blob = await this.generateWord(docContent, filename);
      } else {
        throw new Error('不支持的文档类型');
      }

      this.downloadFile(blob, filename);
      return true;
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
      // 添加表头
      const headers = Object.keys(pageData.items[0] || {});
      data.push(headers);
      
      // 添加数据行
      pageData.items.forEach(item => {
        const row = headers.map(header => item[header] || '');
        data.push(row);
      });
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
