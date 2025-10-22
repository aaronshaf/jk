import type { BuildNode } from "../../lib/jenkins/schemas.ts";
import type { FailureReport } from "../../lib/jenkins/schemas.ts";

/**
 * XML formatting for LLM consumption
 * Provides structured, easily parseable output
 */

/**
 * Escape XML special characters
 */
const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * Format build nodes as XML
 */
export const formatBuildNodesXml = (nodes: BuildNode[]): string => {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push("<build>");
  lines.push(`  <nodes count="${nodes.length}">`);

  for (const node of nodes) {
    lines.push("    <node>");
    lines.push(`      <id>${escapeXml(node.id)}</id>`);
    lines.push(`      <displayName>${escapeXml(node.displayName)}</displayName>`);
    lines.push(`      <state>${escapeXml(node.state)}</state>`);
    if (node.result) {
      lines.push(`      <result>${escapeXml(node.result)}</result>`);
    }
    if (node.startTime) {
      lines.push(`      <startTime>${escapeXml(node.startTime)}</startTime>`);
    }
    if (node.durationInMillis !== undefined) {
      lines.push(`      <durationInMillis>${node.durationInMillis}</durationInMillis>`);
    }
    lines.push("    </node>");
  }

  lines.push("  </nodes>");
  lines.push("</build>");

  return lines.join("\n");
};

export interface FormatFailuresXmlOptions {
  tail?: number;
  grep?: string;
  smart?: boolean;
}

/**
 * Format failure reports as XML
 */
export const formatFailuresXml = (
  failures: FailureReport[],
  options: FormatFailuresXmlOptions = {}
): string => {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Add metadata about filtering
  const mode = options.smart ? "smart" : options.tail ? "tail" : options.grep ? "grep" : "full";
  lines.push(`<failures mode="${mode}">`);

  if (options.tail) {
    lines.push(`  <metadata>`);
    lines.push(`    <tailLines>${options.tail}</tailLines>`);
    lines.push(`  </metadata>`);
  } else if (options.grep) {
    lines.push(`  <metadata>`);
    lines.push(`    <grepPattern>${escapeXml(options.grep)}</grepPattern>`);
    lines.push(`  </metadata>`);
  } else if (options.smart) {
    lines.push(`  <metadata>`);
    lines.push(`    <smartMode>true</smartMode>`);
    lines.push(`    <description>Last 100 lines + all error/fail/exception/fatal lines</description>`);
    lines.push(`  </metadata>`);
  }

  lines.push(`  <count>${failures.length}</count>`);

  // Group by build
  const grouped = new Map<string, FailureReport[]>();
  for (const failure of failures) {
    const key = `${failure.pipeline}/${failure.buildNumber}`;
    const group = grouped.get(key);
    if (!group) {
      grouped.set(key, [failure]);
    } else {
      group.push(failure);
    }
  }

  lines.push("  <builds>");

  for (const [buildKey, buildFailures] of grouped) {
    const [pipeline, buildNum] = buildKey.split("/").slice(-2);
    lines.push("    <build>");
    lines.push(`      <pipeline>${escapeXml(pipeline)}</pipeline>`);
    lines.push(`      <buildNumber>${escapeXml(buildNum)}</buildNumber>`);
    lines.push("      <nodes>");

    for (const failure of buildFailures) {
      lines.push("        <node>");
      lines.push(`          <id>${escapeXml(failure.nodeId)}</id>`);
      lines.push(`          <displayName>${escapeXml(failure.displayName)}</displayName>`);
      lines.push(`          <result>${escapeXml(failure.result)}</result>`);
      lines.push(`          <url>${escapeXml(failure.url)}</url>`);

      if (failure.consoleOutput) {
        lines.push("          <consoleOutput><![CDATA[");
        lines.push(failure.consoleOutput);
        lines.push("]]></consoleOutput>");
      }

      lines.push("        </node>");
    }

    lines.push("      </nodes>");
    lines.push("    </build>");
  }

  lines.push("  </builds>");
  lines.push("</failures>");

  return lines.join("\n");
};
