# Auth email templates

Supabase's default templates use `{{ .ConfirmationURL }}`, which sends people
through the PKCE `code` flow at `/auth/callback`. That flow only completes in
the same browser that started it, because the code verifier is stored in a
cookie there. Request a password reset on a laptop, open the mail on a phone,
and the link fails with:

```
code challenge does not match previously saved code verifier
```

`/auth/confirm` verifies a `token_hash` instead, which needs nothing stored
locally and therefore works wherever the link is opened. Point the templates
at it.

## Where

Supabase dashboard → Authentication → Emails → the template listed below.

## Reset Password

```html
<h2>Reset Password</h2>
<p>Follow this link to set a new password for your preSkool account:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=%2Fauth%2Fupdate-password">
    Set a new password
  </a>
</p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

## Magic Link

```html
<h2>Sign in to preSkool</h2>
<p>Follow this link to sign in:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=%2F">
    Sign in
  </a>
</p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

## Notes

- `Site URL` under Authentication → URL Configuration has to be the real
  origin (`https://preskool.io`), since `{{ .SiteURL }}` expands to it.
- `next` is URL-encoded because it sits inside a query string. `%2F` is `/`.
- `/auth/confirm` refuses an absolute `next` and falls back to `/`, so a
  crafted link cannot carry a freshly-authenticated visitor off-site.
- The magic-link template hardcodes `next=%2F`, which drops the deep-link
  behaviour the login form's `?next=` gives same-browser sign-ins. Working
  cross-device is the better trade for a fallback path.
- `/auth/callback` is still wired up and still handles the PKCE `code` flow.
  Nothing breaks if a template is left on `{{ .ConfirmationURL }}` — it just
  keeps the same-browser limitation.
