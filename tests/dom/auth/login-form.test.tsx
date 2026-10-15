// @vitest-environment jsdom
/**
 * DOM tests for the login form.
 *
 * Password sign-in is the primary path; the magic link is the fallback. The
 * form has no allowlist logic of its own — src/proxy.ts owns that gate — so
 * what matters here is that each button calls the right Supabase method with
 * the typed credentials, and that failures surface instead of silently
 * navigating.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// All factory-captured state hoisted per-file. See CLAUDE.md
// § "Mocking conventions".
const {
  signInWithPasswordMock,
  signInWithOtpMock,
  replaceMock,
  refreshMock,
  searchParamsState,
} = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  signInWithOtpMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  searchParamsState: { value: '' },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signInWithOtp: signInWithOtpMock,
    },
  }),
}));

const EMAIL = 'ramsha@skoolskale.com';
const PASSWORD = 'correct-horse-battery';

beforeEach(() => {
  searchParamsState.value = '';
  signInWithPasswordMock.mockReset();
  signInWithPasswordMock.mockResolvedValue({ error: null });
  signInWithOtpMock.mockReset();
  signInWithOtpMock.mockResolvedValue({ error: null });
  replaceMock.mockReset();
  refreshMock.mockReset();
});

async function renderForm() {
  const { LoginForm } = await import('@/app/auth/login/login-form');
  render(<LoginForm />);
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Work email'), EMAIL);
  await user.type(screen.getByLabelText('Password'), PASSWORD);
}

describe('LoginForm — password sign-in', () => {
  test('signs in with the typed email and password', async () => {
    const user = userEvent.setup();
    await renderForm();
    await fillCredentials(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
    });
  });

  test('navigates to the root after a successful sign-in', async () => {
    const user = userEvent.setup();
    await renderForm();
    await fillCredentials(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(replaceMock).toHaveBeenCalledWith('/');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  test('honours the next parameter after a successful sign-in', async () => {
    searchParamsState.value = 'next=%2Fpackages%2Fabc';
    const user = userEvent.setup();
    await renderForm();
    await fillCredentials(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(replaceMock).toHaveBeenCalledWith('/packages/abc');
  });

  test('ignores an absolute next parameter pointing off-site', async () => {
    searchParamsState.value = 'next=https%3A%2F%2Fevil.example.com';
    const user = userEvent.setup();
    await renderForm();
    await fillCredentials(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  test('shows the error and stays put when the credentials are rejected', async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    const user = userEvent.setup();
    await renderForm();
    await fillCredentials(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid login credentials',
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe('LoginForm — magic link fallback', () => {
  test('sends a magic link to the typed address', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText('Work email'), EMAIL);

    await user.click(
      screen.getByRole('button', { name: 'Email me a magic link instead' }),
    );

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: EMAIL,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2F',
      },
    });
  });

  test('confirms to the user which address the link went to', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText('Work email'), EMAIL);

    await user.click(
      screen.getByRole('button', { name: 'Email me a magic link instead' }),
    );

    expect(await screen.findByText(EMAIL)).toBeInTheDocument();
  });

  test('asks for an address instead of sending a link to nobody', async () => {
    const user = userEvent.setup();
    await renderForm();

    await user.click(
      screen.getByRole('button', { name: 'Email me a magic link instead' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter your email address first.',
    );
    expect(signInWithOtpMock).not.toHaveBeenCalled();
  });

  test('does not sign in with a password when the fallback is used', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.type(screen.getByLabelText('Work email'), EMAIL);

    await user.click(
      screen.getByRole('button', { name: 'Email me a magic link instead' }),
    );

    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });
});

describe('LoginForm — failed email links', () => {
  test('explains a failed link instead of showing a blank sign-in page', async () => {
    searchParamsState.value = 'error=link_failed';
    await renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent(
      /may have expired or already been used/i,
    );
  });

  test('explains an incomplete link', async () => {
    searchParamsState.value = 'error=invalid_link';
    await renderForm();

    expect(screen.getByRole('alert')).toHaveTextContent(/incomplete/i);
  });

  test('does not render text supplied in the error parameter', async () => {
    searchParamsState.value =
      'error=Your+account+was+suspended.+Call+555-0100.';
    await renderForm();

    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveTextContent(/suspended/i);
    expect(alert).not.toHaveTextContent(/555-0100/);
  });

  test('shows no alert on a clean visit to the login page', async () => {
    await renderForm();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('replaces the link error once a sign-in attempt fails', async () => {
    searchParamsState.value = 'error=link_failed';
    signInWithPasswordMock.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    const user = userEvent.setup();
    await renderForm();
    await fillCredentials(user);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid login credentials',
    );
  });
});
