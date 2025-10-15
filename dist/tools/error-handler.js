// Error Handler Tool
export class ErrorHandler {
  constructor() {
    this.name = 'error_handler';
    this.description = 'Handles and logs application errors';
    this.errors = [];
  }

  handleError(error, context = '') {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context: context,
      type: error.constructor.name
    };
    
    this.errors.push(errorInfo);
    console.error('Error handled:', errorInfo);
    
    return errorInfo;
  }

  getErrors(limit = 50) {
    return this.errors.slice(-limit);
  }

  clearErrors() {
    this.errors = [];
  }

  getErrorStats() {
    const errorTypes = {};
    this.errors.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
    });
    
    return {
      total: this.errors.length,
      types: errorTypes,
      recent: this.errors.slice(-10)
    };
  }
}

export default ErrorHandler;