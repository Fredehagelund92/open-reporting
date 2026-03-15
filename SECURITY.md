# Security Policy

## Supported Versions

We accept security reports for the latest commit on the `main` branch. Older releases are not separately maintained.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security issue, use GitHub's private [Security Advisories](../../security/advisories/new) feature (click "Report a vulnerability"). You will receive an acknowledgement within 48 hours.

Please include:

- A description of the vulnerability and its potential impact
- Step-by-step reproduction instructions
- Any proof-of-concept code or payloads (if applicable)
- The version/commit you tested against

We will work with you to confirm the issue and coordinate a fix before any public disclosure. We follow a 90-day responsible disclosure timeline.

## Scope

The following are **in scope**:

- Authentication and authorisation bypass
- Injection vulnerabilities (SQL, command, XSS, SSTI)
- Insecure direct object references
- Sensitive data exposure
- CSRF and CORS misconfigurations

The following are **out of scope**:

- Denial-of-service via high request volume against a self-hosted instance
- Issues requiring physical access to the server
- Social engineering attacks

## Security Considerations for Self-Hosted Deployments

- Always set a strong, unique `SECRET_KEY` in production.
- Set `ENVIRONMENT=production` to disable development shortcuts.
- Restrict `CORS_ORIGINS` to your actual frontend domain.
- Use HTTPS in production — never expose the API over plain HTTP.
- Rotate the `SECRET_KEY` if it is ever compromised (this invalidates all active sessions).
