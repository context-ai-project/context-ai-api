# Auth0 Setup Guide - Context.AI API

Complete guide for configuring Auth0 authentication in the Context.AI backend.

---

## 📋 Overview

Context.AI uses **Auth0** for authentication with JWT tokens validated via JWKS (JSON Web Key Set). The backend validates tokens but does NOT manage users directly—Auth0 is the source of truth for authentication.

### Flow Architecture

```
Frontend (Next.js)       Auth0           Backend (NestJS)
      |                   |                    |
      |-- Login --------->|                    |
      |<-- JWT Token -----|                    |
      |                   |                    |
      |-- API Request with JWT --------------->|
      |                   |                    |
      |                   |<-- Validate JWKS --|
      |                   |                    |
      |<-- Protected Resource ----------------|
```

---

## 🔑 Step 1: Create Auth0 Tenant

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new tenant (e.g., `contextai-dev.auth0.com`)
3. Select **Region** closest to your users
4. Choose **Development** environment type

---

## 🌐 Step 2: Create Auth0 API

This represents your backend API.

1. **Navigate** to: `Applications` → `APIs` → `Create API`

2. **Fill in details**:
   - **Name**: `Context.AI API`
   - **Identifier**: `https://api.contextai.com` (or your production URL)
   - **Signing Algorithm**: `RS256` ✅

3. **Enable Settings**:
   - ✅ **Enable RBAC** (Role-Based Access Control)
   - ✅ **Add Permissions in the Access Token**

4. **Copy the Identifier** → This is your `AUTH0_AUDIENCE`

### Define Permissions (Scopes)

Under the **Permissions** tab, add:

| Permission | Description |
|-----------|-------------|
| `read:knowledge` | View knowledge base documents |
| `write:knowledge` | Upload/manage documents |
| `read:conversations` | View chat history |
| `write:conversations` | Create conversations |
| `admin:sectors` | Manage sectors (admin only) |
| `admin:users` | Manage users (admin only) |

---

## 🖥️ Step 3: Create Machine-to-Machine Application (Optional)

For backend-to-backend communication or testing:

1. **Navigate**: `Applications` → `Applications` → `Create Application`
2. **Name**: `Context.AI Backend M2M`
3. **Type**: `Machine to Machine Applications`
4. **Authorize**: Select `Context.AI API`
5. **Permissions**: Grant necessary scopes

---

## ⚙️ Step 4: Configure Environment Variables

### Backend `.env` Configuration

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.contextai.com
AUTH0_ISSUER=https://your-tenant.auth0.com/
```

### Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH0_DOMAIN` | Your Auth0 tenant domain | `contextai-dev.auth0.com` |
| `AUTH0_AUDIENCE` | API identifier from Step 2 | `https://api.contextai.com` |
| `AUTH0_ISSUER` | Issuer URL (domain + trailing slash) | `https://contextai-dev.auth0.com/` |

### How to Get These Values

1. **AUTH0_DOMAIN**:
   - Go to `Settings` → `General`
   - Copy **Domain** value

2. **AUTH0_AUDIENCE**:
   - Go to `Applications` → `APIs` → Your API
   - Copy **Identifier**

3. **AUTH0_ISSUER**:
   - Same as `AUTH0_DOMAIN` but with `https://` and trailing `/`
   - Format: `https://{AUTH0_DOMAIN}/`

---

## 🔒 Step 5: Security Best Practices

### JWKS Caching

The backend uses JWKS caching to avoid excessive requests to Auth0:

```typescript
// Already configured in jwt.strategy.ts
{
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`
}
```

### Rate Limiting

Auth0 has rate limits for token validation:

| Plan | Limit |
|------|-------|
| **Free** | 7,000 tokens/month |
| **Developer** | 1,000 tokens/month |
| **Professional** | Custom |

**Recommendation**: Enable JWKS caching (default in our setup) to minimize API calls.

---

## 🧪 Step 6: Testing

### Get a Test Token

**Option 1: Using Auth0 Dashboard**

1. Go to `Applications` → `APIs` → Your API → `Test`
2. Copy the `curl` command to get a token
3. Extract the `access_token` from response

**Option 2: Using cURL**

```bash
curl --request POST \
  --url https://YOUR_DOMAIN/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id":"YOUR_CLIENT_ID",
    "client_secret":"YOUR_CLIENT_SECRET",
    "audience":"https://api.contextai.com",
    "grant_type":"client_credentials"
  }'
```

### Test Protected Endpoint

```bash
# Replace {TOKEN} with your access_token
curl -X GET http://localhost:3001/api/v1/knowledge/sources \
  -H "Authorization: Bearer {TOKEN}"
```

**Expected Response**:
- ✅ **200 OK**: Token valid
- ❌ **401 Unauthorized**: Token invalid/expired
- ❌ **403 Forbidden**: Token valid but insufficient permissions

---

## 🛠️ Troubleshooting

### Common Errors

#### 1. `Invalid token: jwt malformed`

**Cause**: Token format is incorrect

**Solution**:
- Ensure you're sending: `Authorization: Bearer {TOKEN}`
- Token should be a JWT with 3 parts separated by dots (header.payload.signature)

#### 2. `Invalid issuer`

**Cause**: `AUTH0_ISSUER` doesn't match token `iss` claim

**Solution**:
- Verify `AUTH0_ISSUER` has trailing slash: `https://your-tenant.auth0.com/`
- Check token payload: `jwt.io` → paste token → inspect `iss` claim

#### 3. `Invalid audience`

**Cause**: `AUTH0_AUDIENCE` doesn't match token `aud` claim

**Solution**:
- Verify `AUTH0_AUDIENCE` matches API identifier exactly
- Check token payload: `jwt.io` → paste token → inspect `aud` claim

#### 4. `Unable to retrieve JWKS`

**Cause**: Network/firewall blocking Auth0

**Solution**:
- Test JWKS endpoint manually:
  ```bash
  curl https://your-tenant.auth0.com/.well-known/jwks.json
  ```
- Check firewall/proxy settings

#### 5. `Token expired`

**Cause**: Token lifetime exceeded (default: 24h)

**Solution**:
- Request a new token
- Adjust token lifetime in Auth0 Dashboard:
  - `Applications` → `APIs` → Your API → `Settings`
  - **Token Expiration (Seconds)**: Default 86400 (24h)

---

## 📊 Monitoring

### Auth0 Logs

Monitor authentication events in Auth0 Dashboard:

1. Go to `Monitoring` → `Logs`
2. Filter by:
   - **Type**: `Success Login`, `Failed Login`, `API Operation`
   - **Application**: Your API
   - **Date Range**

### Backend Logs

The backend logs authentication events via Audit Logging (Issue 6.15):

```typescript
// Example log entries
[AUTH] JWT validation successful for user auth0|123456
[AUTH] JWT validation failed: Token expired
[AUTH] Permission check failed: User lacks 'write:knowledge'
```

---

## 🔄 Frontend Integration

The frontend (Next.js) uses **NextAuth.js** with Auth0 provider.

### Required Frontend Variables

```bash
# .env.local (Frontend)
AUTH0_SECRET=<generate-with-openssl-rand-hex-32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=<from-auth0-spa-application>
AUTH0_CLIENT_SECRET=<from-auth0-spa-application>
AUTH0_AUDIENCE=https://api.contextai.com
```

**Note**: The frontend uses a **different application** (SPA type) in Auth0, while the backend validates tokens from that SPA.

---

## 🚀 Deployment Checklist

- [ ] Create Auth0 tenant (production)
- [ ] Create Auth0 API with permissions
- [ ] Configure environment variables in hosting platform
- [ ] Test token validation in staging
- [ ] Set up monitoring/alerts for auth failures
- [ ] Document emergency access procedures
- [ ] Configure rate limiting (Auth0 + Backend)
- [ ] Enable audit logging for compliance

---

## 📚 Additional Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [JWT.io - Debug Tokens](https://jwt.io/)
- [Auth0 Rate Limits](https://auth0.com/docs/troubleshoot/customer-support/operational-policies/rate-limit-policy)
- [JWKS Specification](https://datatracker.ietf.org/doc/html/rfc7517)
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

**Last Updated**: Phase 6 - Issue 6.1
**Maintained By**: Context.AI Development Team

