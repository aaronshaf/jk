# ADR 0003: XDG-Compliant Config Storage

## Status

Accepted

## Context

Need to decide where to store user configuration (Jenkins URL, credentials). Options:

1. **Home directory root** - `~/.jk/config.json`
2. **XDG standard** - `~/.config/jk/config.json`
3. **Environment variables only** - No file storage

## Decision

Store configuration in XDG-compliant directory with environment variable fallback.

**Location**: `$XDG_CONFIG_HOME/jk/config.json` or `~/.config/jk/config.json`

## Rationale

- **XDG compliance**: Follows modern Unix conventions
- **Clean home directory**: No dotfile pollution in `~`
- **Flexibility**: Supports both file config and environment variables
- **Security validation**: Validates XDG_CONFIG_HOME for path traversal
- **Permissions**: Config file created with 0600 permissions

## Consequences

### Positive
- Follows Unix best practices
- Users can backup `~/.config` easily
- Environment variable override for CI/CD
- Secure file permissions protect credentials

### Negative
- Slightly longer path to config file
- Need to handle XDG_CONFIG_HOME validation

## Implementation

```typescript
// config/manager.ts
export const getConfigDir = (): string => {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const home = os.homedir();

  const baseDir = (() => {
    if (!xdgConfigHome) {
      return path.join(home, ".config");
    }

    // Security: Ensure it's an absolute path
    if (!path.isAbsolute(xdgConfigHome)) {
      console.warn(`Warning: XDG_CONFIG_HOME is not an absolute path`);
      return path.join(home, ".config");
    }

    return xdgConfigHome;
  })();

  return path.join(baseDir, "jk");
};

// Write with secure permissions
fs.writeFileSync(configPath, content, { mode: 0o600 });
```

## Authentication Modes

```typescript
// Direct credentials in config file
{
  "jenkinsUrl": "https://jenkins.example.com",
  "auth": {
    "type": "direct",
    "username": "user",
    "apiToken": "token"
  }
}

// Environment variable mode (for CI)
{
  "auth": { "type": "env" }
}
// Uses: JENKINS_URL, JENKINS_USERNAME, JENKINS_API_TOKEN
```
