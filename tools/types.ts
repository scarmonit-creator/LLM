/**
 * Tool Interface Definition
 * Defines the structure for tools used in the LLM application
 */

export interface Tool {
  name: string;
  description: string;
  execute: (params: any) => any;
}
