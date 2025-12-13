import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useReminderPolling } from '@/hooks/useReminderPolling';

const remindersApi = vi.hoisted(() => ({
  getDue: vi.fn(),
}));

vi.mock('@/api', () => ({
  __esModule: true,
  remindersApi,
}));

const TestComponent = () => {
  const reminders = useReminderPolling();
  return (
    <div>
      <span data-testid="count">{reminders.length}</span>
      <span data-testid="first-id">{reminders[0]?.id ?? ''}</span>
    </div>
  );
};

describe('useReminderPolling', () => {
  let intervalCallback: (() => Promise<void> | void) | undefined;
  let clearSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    remindersApi.getDue.mockResolvedValue([]);

    vi.stubGlobal('setInterval', (cb: TimerHandler) => {
      intervalCallback = cb as () => Promise<void> | void;
      return 123 as any;
    });
    clearSpy = vi.fn();
    vi.stubGlobal('clearInterval', clearSpy as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    intervalCallback = undefined;
  });

  it('fetches due reminders immediately on mount', async () => {
    remindersApi.getDue.mockResolvedValueOnce([{ id: 1 } as any]);

    render(<TestComponent />);

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
    expect(remindersApi.getDue).toHaveBeenCalledTimes(1);
  });

  it('polls every 60 seconds and updates results', async () => {
    remindersApi.getDue
      .mockResolvedValueOnce([{ id: 1 } as any])
      .mockResolvedValueOnce([{ id: 2 } as any]);

    render(<TestComponent />);

    const callback = intervalCallback;
    expect(callback).toBeDefined();

    await waitFor(() => expect(screen.getByTestId('first-id')).toHaveTextContent('1'));

    await act(async () => {
      await callback?.();
    });

    await waitFor(() => expect(remindersApi.getDue).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('first-id')).toHaveTextContent('2'));
  });

  it('clears the polling interval on unmount', async () => {
    const { unmount } = render(<TestComponent />);

    await waitFor(() => expect(remindersApi.getDue).toHaveBeenCalledTimes(1));

    unmount();
    intervalCallback?.();

    expect(remindersApi.getDue).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalled();
  });
});


