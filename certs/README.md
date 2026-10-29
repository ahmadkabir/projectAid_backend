# Database CA certificates

The default setup connects to a **local MySQL/MariaDB** server (see `DB_SSL=false`
in `.env`), so no certificate is needed here.

This directory is for the optional case: a managed MySQL provider (Aiven, RDS,
PlanetScale, ...) that signs its endpoint with a **provider-specific private CA**.
Node's trust store does not know that CA, so it must be supplied explicitly:

1. In the provider's console, open your MySQL service.
2. Find the connection information and download the CA certificate (`ca.pem`).
3. Save it in this directory, e.g. as `provider-ca.pem`.

Then point `.env` at it:

```dotenv
DB_SSL=true
DB_SSL_CA=./certs/provider-ca.pem
```

and verify:

```bash
npm run db:check
```

Expected output includes the server version, a TLS cipher such as
`TLS_AES_256_GCM_SHA384`, and the row counts for the Project Aid tables.

Notes:

- `DB_SSL_CA` accepts an absolute path, a path relative to the backend root, or
  the PEM contents themselves.
- Leave `DB_SSL_REJECT_UNAUTHORIZED` unset (defaults to `true`). Setting it to
  `false` keeps traffic encrypted but stops verifying the server — use only for
  a quick diagnostic, never for a deployment.
- Certificates in this directory are provider-issued and environment-specific;
  `*.pem` is git-ignored so they are not committed by accident.
