import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, NetworkError, calculate } from '../services/calculatorApi';
import { isOperation } from '../types';
import type { CalculateResponse, Operation } from '../types';

const OPERATIONS: { value: Operation; label: string; symbol: string }[] = [
  { value: 'add', label: 'Add', symbol: '+' },
  { value: 'subtract', label: 'Subtract', symbol: '−' },
  { value: 'multiply', label: 'Multiply', symbol: '×' },
  { value: 'divide', label: 'Divide', symbol: '÷' },
  { value: 'power', label: 'Power', symbol: '^' },
  { value: 'sqrt', label: 'Square root', symbol: '√' },
  { value: 'percentage', label: 'Percentage', symbol: '%' },
];

function isUnaryOperation(operation: Operation): boolean {
  return operation === 'sqrt';
}

function parseOperand(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function validateOperand(raw: string): string | null {
  if (raw.trim() === '') return 'Required';
  if (parseOperand(raw) === null) return 'Enter a valid number';
  return null;
}

function formatResult(value: number): string {
  return String(Number(value.toPrecision(12)));
}

function describeResult(response: CalculateResponse): string {
  const symbol = OPERATIONS.find((op) => op.value === response.operation)?.symbol ?? '';
  if (response.operation === 'sqrt') {
    return `√${response.operands[0]}`;
  }
  if (response.operation === 'percentage') {
    return `${response.operands[0]}% of ${response.operands[1]}`;
  }
  return `${response.operands[0]} ${symbol} ${response.operands[1]}`;
}

export default function Calculator() {
  const [operation, setOperation] = useState<Operation>('add');
  const [operandA, setOperandA] = useState('');
  const [operandB, setOperandB] = useState('');
  const [touchedA, setTouchedA] = useState(false);
  const [touchedB, setTouchedB] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalculateResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const unary = isUnaryOperation(operation);
  const errorA = validateOperand(operandA);
  const errorB = unary ? null : validateOperand(operandB);
  const showErrorA = (touchedA || submitted) && errorA !== null;
  const showErrorB = (touchedB || submitted) && errorB !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (loading) return;

    const parsedA = parseOperand(operandA);
    if (parsedA === null) return;
    let operands: number[];
    if (unary) {
      operands = [parsedA];
    } else {
      const parsedB = parseOperand(operandB);
      if (parsedB === null) return;
      operands = [parsedA, parsedB];
    }

    setLoading(true);
    setApiError(null);
    setResult(null);
    try {
      const response = await calculate({ operation, operands });
      setResult(response);
    } catch (err) {
      if (err instanceof ApiError || err instanceof NetworkError) {
        setApiError(err.message);
      } else {
        setApiError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOperationChange(next: string) {
    if (!isOperation(next)) return;
    setOperation(next);
    setResult(null);
    setApiError(null);
  }

  const operationSymbol = OPERATIONS.find((op) => op.value === operation)?.symbol ?? '';
  const annunciator = loading ? 'BUSY' : apiError ? 'ERR' : result ? '=' : 'RDY';

  return (
    <section className="calculator" aria-label="Calculator">
      <header className="plate">
        <h1>Calculator</h1>
        <span className="plate-model" aria-hidden="true">FS-01</span>
      </header>

      <div className="display">
        <div className="annunciators" aria-hidden="true">
          <span>{operationSymbol}</span>
          <span className={apiError ? 'annunciator-err' : undefined}>{annunciator}</span>
        </div>
        {apiError && (
          <div className="display-error" role="alert">
            {apiError}
          </div>
        )}
        {result && (
          <div className="display-result" aria-live="polite">
            <span className="result-expression">{describeResult(result)} =</span>
            <span
              className="result-value"
              data-size={formatResult(result.result).length > 10 ? 'long' : 'normal'}
            >
              {formatResult(result.result)}
            </span>
          </div>
        )}
        {!apiError && !result && (
          <div className="display-idle" data-busy={loading} aria-hidden="true">
            0
          </div>
        )}
      </div>
      <p className="display-caption" aria-hidden="true">
        <span>POST /api/v1/calculate</span>
        <span>JSON</span>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="operation">Operation</label>
          <select
            id="operation"
            value={operation}
            onChange={(e) => handleOperationChange(e.target.value)}
          >
            {OPERATIONS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label} ({op.symbol})
              </option>
            ))}
          </select>
        </div>

        <div className="operands">
          <div className="field">
            <label htmlFor="operand-a">
              {operation === 'percentage' ? 'Percentage (a)' : unary ? 'Number' : 'First number'}
            </label>
            <input
              id="operand-a"
              type="text"
              inputMode="decimal"
              value={operandA}
              onChange={(e) => setOperandA(e.target.value)}
              onBlur={() => setTouchedA(true)}
              aria-invalid={showErrorA}
              aria-describedby={showErrorA ? 'operand-a-error' : undefined}
            />
            {showErrorA && (
              <p id="operand-a-error" className="field-error" role="alert">
                {errorA}
              </p>
            )}
          </div>

          {!unary && (
            <div className="field">
              <label htmlFor="operand-b">
                {operation === 'percentage' ? 'Of value (b)' : 'Second number'}
              </label>
              <input
                id="operand-b"
                type="text"
                inputMode="decimal"
                value={operandB}
                onChange={(e) => setOperandB(e.target.value)}
                onBlur={() => setTouchedB(true)}
                aria-invalid={showErrorB}
                aria-describedby={showErrorB ? 'operand-b-error' : undefined}
              />
              {showErrorB && (
                <p id="operand-b-error" className="field-error" role="alert">
                  {errorB}
                </p>
              )}
            </div>
          )}
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </form>

      <p className="brand" aria-hidden="true">
        FastAPI × React
      </p>
    </section>
  );
}
