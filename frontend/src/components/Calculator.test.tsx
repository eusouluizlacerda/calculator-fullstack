import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Calculator from './Calculator';
import type { CalculateResponse } from '../types';

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Calculator', () => {
  it('renders the form controls', () => {
    render(<Calculator />);

    expect(screen.getByRole('heading', { name: 'Calculator' })).toBeInTheDocument();
    expect(screen.getByLabelText('Operation')).toBeInTheDocument();
    expect(screen.getByLabelText('First number')).toBeInTheDocument();
    expect(screen.getByLabelText('Second number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeInTheDocument();
  });

  it('blocks submission with empty inputs and does not call fetch', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getAllByText('Required')).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks submission with non-numeric input and does not call fetch', async () => {
    const user = userEvent.setup();
    render(<Calculator />);

    await user.type(screen.getByLabelText('First number'), 'abc');
    await user.type(screen.getByLabelText('Second number'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByText('Enter a valid number')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('displays the result after a successful calculation', async () => {
    const payload: CalculateResponse = { result: 5, operation: 'add', operands: [2, 3] };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));
    const user = userEvent.setup();
    render(<Calculator />);

    await user.type(screen.getByLabelText('First number'), '2');
    await user.type(screen.getByLabelText('Second number'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('2 + 3 =')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'add', operands: [2, 3] }),
    });
  });

  it('displays the API error message on a divide-by-zero 400', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: 'division_by_zero', detail: 'Cannot divide by zero' }),
    );
    const user = userEvent.setup();
    render(<Calculator />);

    await user.selectOptions(screen.getByLabelText('Operation'), 'divide');
    await user.type(screen.getByLabelText('First number'), '5');
    await user.type(screen.getByLabelText('Second number'), '0');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Cannot divide by zero');
  });

  it('hides the second operand for sqrt and sends a single operand', async () => {
    const payload: CalculateResponse = { result: 3, operation: 'sqrt', operands: [9] };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));
    const user = userEvent.setup();
    render(<Calculator />);

    await user.selectOptions(screen.getByLabelText('Operation'), 'sqrt');

    expect(screen.queryByLabelText('Second number')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Number')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Number'), '9');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'sqrt', operands: [9] }),
    });
  });

  it('disables the submit button while the request is pending', async () => {
    let resolveFetch!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<Calculator />);

    await user.type(screen.getByLabelText('First number'), '2');
    await user.type(screen.getByLabelText('Second number'), '3');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(screen.getByRole('button', { name: 'Calculating…' })).toBeDisabled();

    resolveFetch(jsonResponse(200, { result: 5, operation: 'add', operands: [2, 3] }));

    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calculate' })).toBeEnabled();
  });

  it('shows the network error message when fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<Calculator />);

    await user.type(screen.getByLabelText('First number'), '1');
    await user.type(screen.getByLabelText('Second number'), '2');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Could not reach the calculator service. Check your connection and try again.',
    );
  });

  it('formats floating-point artifacts in the displayed result', async () => {
    const payload: CalculateResponse = {
      result: 0.30000000000000004,
      operation: 'add',
      operands: [0.1, 0.2],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));
    const user = userEvent.setup();
    render(<Calculator />);

    await user.type(screen.getByLabelText('First number'), '0.1');
    await user.type(screen.getByLabelText('Second number'), '0.2');
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('0.3')).toBeInTheDocument();
  });
});
