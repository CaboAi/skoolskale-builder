// @vitest-environment jsdom
/**
 * DOM tests for the two password-recovery forms.
 *
 * The forgot-password form must never reveal whether an address is
 * registered, so its confirmation copy is deliberately conditional and is
 * shown on every success. The update-password form gates on the shared
 * validator before it will call Supabase at all.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';

// All factory-captured state hoisted per-file. See CLAUDE.md
// § "Mocking conventions".
const { resetPasswordForEmailMock, updateUserMock, replaceMock, refreshMock } =
  vi.hoisted(() => ({
    resetPasswordForEmailMock: vi.fn(),
    updateUserMock: vi.fn(),
    replaceMock: vi.fn(),
    refreshMock: vi.fn(),
  }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: resetPasswordForEmailMock,
      updateUser: updateUserMock,
    },
  }),
}));

const EMAIL = 'domenic@skoolskale.com';
const VALID_PASSWORD = 'a'.repeat(MIN_PASSWORD_LENGTH);

beforeEach(() => {
  resetPasswordForEmailMock.mockReset();
  resetPasswordForEmailMock.mockResolvedValue({ error: null });
  updateUserMock.mockReset();
  updateUserMock.mockResolvedValue({ error: null });
  replaceMock.mockReset();
  refreshMock.mockReset();
});

describe('ForgotPasswordForm', () => {
  async function renderForm() {
    const { ForgotPasswordForm } = await import(
      '@/app/auth/forgot-password/forgot-password-form'
    );
    render(<ForgotPasswordForm />);
  }

  test('sends the reset link back through the auth callback', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText('Work email'), EMAIL);

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith(EMAIL, {
      redirectTo:
        'http://localhost:3000/auth/callback?next=%2Fauth%2Fupdate-password',
    });
  });

  test('confirms without revealing whether the address is registered', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText('Work email'), EMAIL);

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    const confirmation = await screen.findByText(/if that address belongs to/i);
    expect(confirmation).toBeInTheDocument();
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument();
  });

  test('surfaces a rate-limit error instead of claiming success', async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: { message: 'Email rate limit exceeded' },
    });
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText('Work email'), EMAIL);

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email rate limit exceeded',
    );
    expect(
      screen.queryByText(/if that address belongs to/i),
    ).not.toBeInTheDocument();
  });
});

describe('UpdatePasswordForm', () => {
  async function renderForm() {
    const { UpdatePasswordForm } = await import(
      '@/app/auth/update-password/update-password-form'
    );
    render(<UpdatePasswordForm />);
  }

  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    password: string,
    confirmation: string,
  ) {
    if (password) {
      await user.type(screen.getByLabelText('New password'), password);
    }
    if (confirmation) {
      await user.type(
        screen.getByLabelText('Confirm new password'),
        confirmation,
      );
    }
  }

  test('saves a valid matching password', async () => {
    const user = userEvent.setup();
    await renderForm();
    await fill(user, VALID_PASSWORD, VALID_PASSWORD);

    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(updateUserMock).toHaveBeenCalledWith({ password: VALID_PASSWORD });
  });

  test('sends the user into the app once the password is set', async () => {
    const user = userEvent.setup();
    await renderForm();
    await fill(user, VALID_PASSWORD, VALID_PASSWORD);

    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(replaceMock).toHaveBeenCalledWith('/');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  test('refuses a too-short password without calling Supabase', async () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const user = userEvent.setup();
    await renderForm();
    await fill(user, short, short);

    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test('refuses a mismatched pair without calling Supabase', async () => {
    const user = userEvent.setup();
    await renderForm();
    await fill(user, VALID_PASSWORD, `${VALID_PASSWORD}x`);

    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('match');
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  test('surfaces a Supabase rejection instead of navigating away', async () => {
    updateUserMock.mockResolvedValue({
      error: { message: 'New password should be different from the old one.' },
    });
    const user = userEvent.setup();
    await renderForm();
    await fill(user, VALID_PASSWORD, VALID_PASSWORD);

    await user.click(screen.getByRole('button', { name: 'Set password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'should be different',
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
