import { describe, expect, test } from "bun:test";
import type { BuildNode, BuildSummary } from "../src/lib/jenkins/schemas.ts";
import { formatBuildNodesXml, formatBuildsXml } from "../src/cli/formatters/xml.ts";

describe("formatBuildNodesXml", () => {
  test("formats nodes with valid states", () => {
    const nodes: BuildNode[] = [
      {
        id: "1",
        displayName: "Test Stage",
        result: "SUCCESS",
        state: "FINISHED",
        startTime: "2025-11-25T04:53:00.870+0000",
        durationInMillis: 5000,
        actions: [],
      },
    ];

    const xml = formatBuildNodesXml(nodes);
    expect(xml).toContain("<state>FINISHED</state>");
    expect(xml).toContain("<result>SUCCESS</result>");
    expect(xml).toContain("<displayName>Test Stage</displayName>");
  });

  test("formats nodes with null state as UNKNOWN", () => {
    const nodes: BuildNode[] = [
      {
        id: "5",
        displayName: "Problematic Stage",
        result: "FAILURE",
        state: null,
        actions: [],
      },
    ];

    const xml = formatBuildNodesXml(nodes);
    expect(xml).toContain("<state>UNKNOWN</state>");
    expect(xml).toContain("<result>FAILURE</result>");
    expect(xml).toContain("<displayName>Problematic Stage</displayName>");
  });

  test("formats nodes with null result and null state", () => {
    const nodes: BuildNode[] = [
      {
        id: "10",
        displayName: "Queued Stage",
        result: null,
        state: null,
        actions: [],
      },
    ];

    const xml = formatBuildNodesXml(nodes);
    expect(xml).toContain("<state>UNKNOWN</state>");
    expect(xml).not.toContain("<result>");
    expect(xml).toContain("<displayName>Queued Stage</displayName>");
  });

  test("formats multiple nodes with mixed states", () => {
    const nodes: BuildNode[] = [
      {
        id: "1",
        displayName: "Stage 1",
        result: "SUCCESS",
        state: "FINISHED",
        actions: [],
      },
      {
        id: "2",
        displayName: "Stage 2",
        result: "FAILURE",
        state: null,
        actions: [],
      },
      {
        id: "3",
        displayName: "Stage 3",
        result: null,
        state: "RUNNING",
        actions: [],
      },
    ];

    const xml = formatBuildNodesXml(nodes);
    expect(xml).toContain('count="3"');
    expect(xml).toContain("<state>FINISHED</state>");
    expect(xml).toContain("<state>UNKNOWN</state>");
    expect(xml).toContain("<state>RUNNING</state>");
  });

  test("produces valid XML structure", () => {
    const nodes: BuildNode[] = [
      {
        id: "1",
        displayName: "Test",
        state: null,
        actions: [],
      },
    ];

    const xml = formatBuildNodesXml(nodes);
    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<build>");
    expect(xml).toContain("</build>");
    expect(xml).toContain("<nodes");
    expect(xml).toContain("</nodes>");
  });
});

describe("formatBuildsXml", () => {
  test("formats builds with valid states", () => {
    const builds: BuildSummary[] = [
      {
        id: "100",
        result: "SUCCESS",
        state: "FINISHED",
        startTime: "2025-11-25T04:53:00.870+0000",
        durationInMillis: 10000,
        runSummary: null,
        _links: {
          self: {
            href: "/blue/rest/organizations/jenkins/pipelines/test/runs/100/",
          },
        },
      },
    ];

    const xml = formatBuildsXml(builds);
    expect(xml).toContain("<state>FINISHED</state>");
    expect(xml).toContain("<result>SUCCESS</result>");
    expect(xml).toContain("<id>100</id>");
  });

  test("formats builds with null state as UNKNOWN", () => {
    const builds: BuildSummary[] = [
      {
        id: "200",
        result: "FAILURE",
        state: null,
        startTime: null,
        durationInMillis: null,
        runSummary: null,
        _links: {
          self: {
            href: "/blue/rest/organizations/jenkins/pipelines/test/runs/200/",
          },
        },
      },
    ];

    const xml = formatBuildsXml(builds);
    expect(xml).toContain("<state>UNKNOWN</state>");
    expect(xml).toContain("<result>FAILURE</result>");
    expect(xml).toContain("<id>200</id>");
  });

  test("formats multiple builds with mixed states", () => {
    const builds: BuildSummary[] = [
      {
        id: "100",
        result: "SUCCESS",
        state: "FINISHED",
        startTime: null,
        durationInMillis: null,
        runSummary: null,
        _links: { self: { href: "/runs/100/" } },
      },
      {
        id: "101",
        result: null,
        state: null,
        startTime: null,
        durationInMillis: null,
        runSummary: null,
        _links: { self: { href: "/runs/101/" } },
      },
      {
        id: "102",
        result: "FAILURE",
        state: "FINISHED",
        startTime: null,
        durationInMillis: null,
        runSummary: null,
        _links: { self: { href: "/runs/102/" } },
      },
    ];

    const xml = formatBuildsXml(builds);
    expect(xml).toContain("<state>FINISHED</state>");
    expect(xml).toContain("<state>UNKNOWN</state>");
    const finishedCount = (xml.match(/<state>FINISHED<\/state>/g) || []).length;
    const unknownCount = (xml.match(/<state>UNKNOWN<\/state>/g) || []).length;
    expect(finishedCount).toBe(2);
    expect(unknownCount).toBe(1);
  });

  test("produces valid XML structure", () => {
    const builds: BuildSummary[] = [
      {
        id: "1",
        state: null,
        result: null,
        startTime: null,
        durationInMillis: null,
        runSummary: null,
        _links: { self: { href: "/runs/1/" } },
      },
    ];

    const xml = formatBuildsXml(builds);
    expect(xml).toStartWith('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<builds>");
    expect(xml).toContain("</builds>");
    expect(xml).toContain("<build>");
    expect(xml).toContain("</build>");
  });
});
