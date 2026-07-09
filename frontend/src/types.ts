export const OPERATION_VALUES = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'power',
  'sqrt',
  'percentage',
] as const;

export type Operation = (typeof OPERATION_VALUES)[number];

export function isOperation(value: string): value is Operation {
  return (OPERATION_VALUES as readonly string[]).includes(value);
}

export interface CalculateRequest {
  operation: Operation;
  operands: number[];
}

export interface CalculateResponse {
  result: number;
  operation: Operation;
  operands: number[];
}

export interface ApiErrorBody {
  error: string;
  detail: string;
}
