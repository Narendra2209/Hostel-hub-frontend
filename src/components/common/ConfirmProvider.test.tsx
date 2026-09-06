/**
 * `useConfirm()` replaces `window.confirm` for every destructive action in the
 * app, so the promise it hands back has to settle correctly on all three exits:
 * the confirm button, the cancel button and Escape. A promise that never
 * settles would leave a delete handler hanging forever.
 */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/utils';
import { ConfirmProvider, useConfirm, type ConfirmOptions } from './ConfirmProvider';

const OPTIONS: ConfirmOptions = {
  title: 'Remove resident?',
  message: 'Their payment history stays on file.',
  tone: 'danger',
};

/** Records whatever the promise settles with, so the test can assert on it. */
function Harness({ options = OPTIONS }: { options?: ConfirmOptions }): JSX.Element {
  const confirm = useConfirm();
  const [outcome, setOutcome] = useState('pending');

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOutcome('pending');
          void confirm(options).then((answer) => setOutcome(String(answer)));
        }}
      >
        Delete resident
      </button>
      <output data-testid="outcome">{outcome}</output>
    </>
  );
}

const outcome = (): HTMLElement => screen.getByTestId('outcome');
const dialog = (): HTMLElement => screen.getByRole('dialog');

async function openDialog(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Delete resident' }));
  await screen.findByRole('dialog');
}

describe('ConfirmProvider', () => {
  it('shows nothing until something asks for a confirmation', () => {
    renderWithProviders(<Harness />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(outcome()).toHaveTextContent('pending');
  });

  it('renders an accessible modal dialog labelled by its title', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await openDialog(user);

    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(dialog()).toHaveAccessibleName('Remove resident?');
    expect(within(dialog()).getByText('Their payment history stays on file.')).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Confirm' })).toHaveClass('danger');
  });

  it('resolves true when Confirm is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await openDialog(user);

    await user.click(within(dialog()).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(outcome()).toHaveTextContent('true'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await openDialog(user);

    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(outcome()).toHaveTextContent('false'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false when Escape is pressed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await openDialog(user);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(outcome()).toHaveTextContent('false'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uses the labels the caller asked for', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Harness
        options={{
          title: 'Reverse this payment?',
          message: 'The ledger will be recalculated.',
          confirmLabel: 'Reverse it',
          cancelLabel: 'Keep it',
        }}
      />,
    );
    await openDialog(user);

    expect(within(dialog()).getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: 'Reverse it' }));

    await waitFor(() => expect(outcome()).toHaveTextContent('true'));
  });

  it('can be asked again after an answer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);

    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(outcome()).toHaveTextContent('false'));

    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(outcome()).toHaveTextContent('true'));
  });

  it('refuses to work outside its provider', () => {
    // Rendered bare: `renderWithProviders` would supply the context this checks for.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Orphan />)).toThrow(/useConfirm must be used inside/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('still works when the provider is mounted by hand', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmProvider>
        <Harness />
      </ConfirmProvider>,
    );

    await openDialog(user);
    await user.click(within(dialog()).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(outcome()).toHaveTextContent('true'));
  });
});

function Orphan(): JSX.Element {
  useConfirm();
  return <span>unreachable</span>;
}
