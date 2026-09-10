// @vitest-environment jsdom
/**
 * DOM tests for the header account menu.
 *
 * Before this existed there was no way to sign out from inside the app, and
 * no route to the set-password page for anyone already signed in. Both live
 * behind the same popover, so the tests open it first.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// All factory-captured state hoisted per-file. See CLAUDE.md
// § "Mocking conventions".
const { signOutMock, replaceMock, refreshMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

const EMAIL = 'mario@skoolskale.com';

beforeEach(() => {
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  replaceMock.mockReset();
  refreshMock.mockReset();
});

async function renderMenu() {
  const { AccountMenu } = await import('@/components/branding/AccountMenu');
  render(<AccountMenu email={EMAIL} />);
  return userEvent.setup();
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('button', { name: `Account menu for ${EMAIL}` }),
  );
}

describe('AccountMenu', () => {
  test('names the signed-in account on the trigger', async () => {
    await renderMenu();

    expect(
      screen.getByRole('button', { name: `Account menu for ${EMAIL}` }),
    ).toHaveTextContent(EMAIL);
  });

  test('keeps sign-out out of reach until the menu is opened', async () => {
    await renderMenu();

    expect(
      screen.queryByRole('button', { name: 'Sign out' }),
    ).not.toBeInTheDocument();
  });

  test('offers a route to the set-password page once opened', async () => {
    const user = await renderMenu();
    await openMenu(user);

    expect(
      await screen.findByRole('link', { name: 'Change password' }),
    ).toHaveAttribute('href', '/auth/update-password');
  });

  test('signs the user out of Supabase', async () => {
    const user = await renderMenu();
    await openMenu(user);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  test('sends the signed-out user to the login page', async () => {
    const user = await renderMenu();
    await openMenu(user);

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(replaceMock).toHaveBeenCalledWith('/auth/login');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  test('does not sign out merely from opening the menu', async () => {
    const user = await renderMenu();
    await openMenu(user);

    expect(signOutMock).not.toHaveBeenCalled();
  });
});
