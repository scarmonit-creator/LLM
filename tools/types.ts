/**
 * Tool Interface Definition
 * Defines the structure for tools used in the LLM application
 */
export interface Tool {
  name: string;
  description: string;
  parameters?: any; // Optional parameters field to support various tool configurations
  execute: (params: any) => any;
}
