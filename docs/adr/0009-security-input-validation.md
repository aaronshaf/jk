# ADR 0009: Security-Focused Input Validation

## Status

Accepted

## Context

CLI tools accepting URLs and paths are vulnerable to injection attacks. Need a security strategy for:

- Pipeline paths (could contain path traversal)
- Grep patterns (could cause ReDoS)
- XDG_CONFIG_HOME (could point to malicious location)

## Decision

Implement comprehensive input validation at all entry points with security-focused defaults.

## Rationale

- **Defense in depth**: Validate at multiple layers
- **Fail secure**: Reject suspicious input rather than try to sanitize
- **No shell injection**: Never pass user input to shell
- **Credential protection**: Never expose credentials in errors

## Security Measures

### 1. Path Validation

```typescript
// locator.ts
const SAFE_PATH_SEGMENT_REGEX = /^[a-zA-Z0-9_.-]+$/;

const validatePipelinePath = (path: string): boolean => {
  const segments = path.split('/').filter(seg => seg.length > 0);

  for (const segment of segments) {
    // Only safe characters allowed
    if (!SAFE_PATH_SEGMENT_REGEX.test(segment)) {
      return false;
    }
    // Prevent path traversal
    if (segment === '..' || segment === '.') {
      return false;
    }
  }
  return segments.length > 0;
};
```

### 2. XDG_CONFIG_HOME Validation

```typescript
// config/manager.ts
const baseDir = (() => {
  if (!xdgConfigHome) {
    return path.join(home, ".config");
  }

  // Must be absolute path
  if (!path.isAbsolute(xdgConfigHome)) {
    console.warn(`Warning: XDG_CONFIG_HOME is not absolute`);
    return path.join(home, ".config");
  }

  // Must be in safe location
  const resolved = path.resolve(xdgConfigHome);
  const isInHome = resolved.startsWith(path.resolve(home));
  const isSystemConfig = resolved.startsWith('/etc');

  if (!isInHome && !isSystemConfig) {
    console.warn(`Warning: XDG_CONFIG_HOME outside safe directories`);
    return path.join(home, ".config");
  }

  return resolved;
})();
```

### 3. ReDoS Prevention

```typescript
// commands/failures.ts
const validateGrepPattern = (pattern: string): string | null => {
  // Length limit
  if (pattern.length > 200) {
    return "Pattern too long (max 200 characters)";
  }

  // Nested quantifiers cause exponential backtracking
  const nestedQuantifiers = /(\(\??[^)]*[*+]\)?)[*+{]/g;
  if (nestedQuantifiers.test(pattern)) {
    return "Pattern contains nested quantifiers";
  }

  // Too many alternations
  const alternationCount = (pattern.match(/\|/g) || []).length;
  if (alternationCount > 20) {
    return "Pattern contains too many alternations (max 20)";
  }

  // Test compilation
  try {
    new RegExp(pattern);
  } catch (error) {
    return `Invalid regex: ${error}`;
  }

  return null; // Valid
};
```

### 4. Credential Protection

```typescript
// Config file permissions
fs.writeFileSync(configPath, content, { mode: 0o600 });

// Error messages never include credentials
console.error(red(`Error: ${error.message}`));
// URL only shown with --verbose
if (options.verbose && "url" in error && error.url) {
  console.error(gray(`URL: ${error.url}`));
}
```

### 5. Notification Security

```typescript
// notifications.ts - No shell injection
// Pass script via stdin, not command line
const proc = spawn("osascript", ["-"], {
  stdio: ["pipe", "ignore", "ignore"],
});
proc.stdin.write(script);
proc.stdin.end();

// Linux: spawn bypasses shell
spawn("notify-send", [title, body], { stdio: "ignore" });
```

## Consequences

### Positive
- No path traversal vulnerabilities
- No ReDoS vulnerabilities
- Credentials never leaked in errors
- No shell injection possible

### Negative
- Some valid paths rejected (special chars)
- Regex power limited for safety
- Extra validation overhead
