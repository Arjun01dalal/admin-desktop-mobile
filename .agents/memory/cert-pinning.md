---
name: cert-pinning
description: How/why main-process HTTPS is certificate-pinned and how to rotate pins.
---
- Only `laxminarayan.live` (and subdomains) is pinned. Third-party hosts (dialer ganesha999.com, helper.callingbot.live, ipapi.co, cloudfront) are intentionally NOT pinned — we don't control their certs.
- We pin the SPKI SHA-256 hash (not the leaf cert), and include the Sectigo intermediate CA hash as a backup so ~90-day leaf renewals don't brick installed apps.
- **Why:** leaf cert renews and its bytes change, but the public key (and always the issuing intermediate) stay stable; pinning SPKI + intermediate survives renewal while still rejecting mitm proxies.
- **How to apply:** if the server re-keys AND changes issuer, regenerate hashes (openssl command is documented in electron/certPin.cjs header) and ship an app update before the old cert expires, or installed apps fail closed.
