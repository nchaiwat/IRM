# AD Sync Agent — API Integration Guide

## 1. Overview
The Identity Gateway (AD Sync Agent) acts as a secure bridge between your application and the internal Active Directory (AD) on 192.168.12.11.

## 2. API Endpoint
* **Endpoint:** `POST /api/v2/login`
* **Transport:** HTTPS (via Reverse Tunnel)
* **Port:** 3100

## 3. Request Body Structure
All requests must include:

```json
{
  "app_id": "string",       // Registered ID in registry.json
  "secret_key": "string",   // Corresponding secret key
  "username": "string",     // AD sAMAccountName
  "password": "string",     // AD user password
  "timestamp": "string"     // ISO 8601 Format (e.g., 2026-09-02T14:00:34Z)
}
```

## 4. Developer Requirements
1. **IP Whitelisting:** Your VPS IP (`157.173.219.153`) must be included in the `allowed_ips` list within the server's `registry.json`.
2. **IP Header:** Include `X-Forwarded-For: 157.173.219.153` in your request headers to ensure the gateway correctly identifies your origin.
3. **Time Sync:** Ensure the request `timestamp` is within 5 minutes of the server clock, formatted as ISO 8601.
4. **Group Authorization:** The AD user MUST be a member of the group defined in the server's `registry.json` (`required_group`) for that specific `app_id`.

## 5. Security Protocols
* **Masking:** Passwords in the system logs are automatically masked to maintain security (`Oxxxxxxxxx!`).
* **Rate Limiting:** Maximum 60 requests per minute per IP.
* **Timestamping:** Requests are rejected if they exceed the 300-second drift limit to prevent replay attacks.
