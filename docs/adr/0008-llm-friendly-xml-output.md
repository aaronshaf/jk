# ADR 0008: LLM-Friendly XML Output

## Status

Accepted

## Context

CLI output needs to be consumable by both humans and AI tools (Claude, GPT, etc.). Options:

1. **Human text only** - Color-coded, formatted for terminals
2. **JSON output** - Machine-readable, verbose
3. **XML with CDATA** - Structured, handles special chars, LLM-friendly

## Decision

Add `--xml` flag to all data-outputting commands. XML uses CDATA sections for console output.

## Rationale

- **LLM consumption**: XML is well-understood by language models
- **Structured data**: Clear field separation vs prose
- **CDATA safety**: Console output often contains XML-like content (`<tag>`)
- **Composability**: Pipe directly to AI tools
- **No escaping issues**: CDATA wraps raw console output

## Consequences

### Positive
- AI tools can parse output reliably
- Pipe directly to `claude`, `llm`, etc.
- Console output preserved exactly
- Clear metadata (mode, filtering applied)

### Negative
- Verbose compared to JSON
- Two code paths for formatting
- CDATA has edge case (`]]>` sequence)

## Implementation

```bash
# XML output for failures
jk failures --xml <build>

# Smart mode with XML
jk failures --smart --xml <build>

# Pipe to AI tool
jk failures --smart --xml <build> | claude "Analyze these failures"
```

```typescript
// formatters/xml.ts
export const formatFailuresXml = (
  failures: FailureReport[],
  options: { tail?: number; grep?: string; smart?: boolean } = {}
): string => {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  const mode = options.smart ? "smart" : options.tail ? "tail" : "full";
  lines.push(`<failures mode="${mode}">`);

  // Metadata section
  lines.push(`  <metadata>`);
  lines.push(`    <totalFailures>${failures.length}</totalFailures>`);
  if (options.smart) {
    lines.push(`    <description>Last 100 lines + error/fail/exception lines</description>`);
  }
  lines.push(`  </metadata>`);

  // Failures grouped by build
  for (const failure of failures) {
    lines.push("    <node>");
    lines.push(`      <displayName>${escapeXml(failure.displayName)}</displayName>`);
    lines.push(`      <url>${escapeXml(failure.url)}</url>`);

    // Console output in CDATA (no escaping needed)
    if (failure.consoleOutput) {
      lines.push("      <consoleOutput><![CDATA[");
      lines.push(failure.consoleOutput);  // Raw, unescaped
      lines.push("]]></consoleOutput>");
    }
    lines.push("    </node>");
  }

  lines.push("</failures>");
  return lines.join("\n");
};
```

## Example Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<failures mode="smart">
  <metadata>
    <totalFailures>2</totalFailures>
    <smartMode>true</smartMode>
  </metadata>
  <builds>
    <build>
      <pipeline>test-suite</pipeline>
      <buildNumber>123</buildNumber>
      <nodes>
        <node>
          <displayName>Run Jest Tests</displayName>
          <url>https://jenkins.example.com/blue/.../pipeline/456</url>
          <consoleOutput><![CDATA[
FAIL src/components/Button.test.tsx
  ● Button › renders correctly
    expect(received).toBe(expected)
    Expected: "Click me"
    Received: "Click Me"
]]></consoleOutput>
        </node>
      </nodes>
    </build>
  </builds>
</failures>
```
