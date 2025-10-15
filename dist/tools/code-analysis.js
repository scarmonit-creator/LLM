// Code Analysis Tool
import * as fs from 'fs';
import * as path from 'path';

export class CodeAnalyzer {
  constructor() {
    this.name = 'code_analyzer';
    this.description = 'Analyzes code structure, complexity, and quality';
  }

  async analyzeFile(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const stats = {
        lines: content.split('\n').length,
        characters: content.length,
        functions: this.countFunctions(content),
        classes: this.countClasses(content),
        imports: this.countImports(content)
      };
      return stats;
    } catch (error) {
      throw new Error(`Failed to analyze file: ${error.message}`);
    }
  }

  countFunctions(content) {
    const functionRegex = /function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g;
    return (content.match(functionRegex) || []).length;
  }

  countClasses(content) {
    const classRegex = /class\s+\w+/g;
    return (content.match(classRegex) || []).length;
  }

  countImports(content) {
    const importRegex = /import\s+/g;
    return (content.match(importRegex) || []).length;
  }

  async analyzeDirectory(dirPath) {
    const results = {};
    const files = await fs.promises.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fs.promises.stat(filePath);
      
      if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.ts'))) {
        results[file] = await this.analyzeFile(filePath);
      }
    }
    
    return results;
  }
}

export default CodeAnalyzer;