/**
 * Tests for mode-gated tool registration
 */

import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  allTools,
  brainTools,
  dangerousOperatorToolNames,
  dangerousOperatorTools,
  getToolStats,
  getToolsForMode,
  operatorTools,
  registerAllTools,
  safeOperatorTools,
} from '../../../src/tools/index.js';
import { createMockToolContext } from '../../mocks/tool-context.mock.js';
import { createTestConfig } from '../../../src/config/index.js';

function createFakeServer(): McpServer & { tool: ReturnType<typeof vi.fn> } {
  return {
    tool: vi.fn(),
  } as unknown as McpServer & { tool: ReturnType<typeof vi.fn> };
}

describe('tool registry modes', () => {
  it('preserves the full operator tool inventory', () => {
    expect(operatorTools).toHaveLength(117);
    expect(allTools).toHaveLength(135);
    expect(getToolStats().operator).toBe(117);
    expect(safeOperatorTools).toHaveLength(91);
    expect(dangerousOperatorTools).toHaveLength(26);
    expect(getToolStats().operatorSafe).toBe(91);
    expect(getToolStats().operatorDangerous).toBe(26);
    expect(dangerousOperatorToolNames).toContain('vmix_batch');
    expect(dangerousOperatorToolNames).toContain('vmix_record');
    expect(dangerousOperatorToolNames).toContain('vmix_stream');
    expect(dangerousOperatorToolNames).toContain('vmix_script_run');
    expect(dangerousOperatorToolNames).toContain('vmix_preset_open');
  });

  it('exposes the Phase 3 review tools by default', () => {
    expect(brainTools).toHaveLength(18);
    expect(getToolsForMode(false)).toHaveLength(18);
    expect(getToolStats().brain).toBe(18);
    expect(brainTools[0]?.name).toBe('vmix_server_version');
    expect(brainTools[1]?.name).toBe('vmix_show_review');
    expect(brainTools[2]?.name).toBe('vmix_analyze_preset');
    expect(brainTools[3]?.name).toBe('vmix_generate_show_checklist');
    expect(brainTools[4]?.name).toBe('vmix_find_input');
    expect(brainTools[5]?.name).toBe('vmix_explain_input');
    expect(brainTools[6]?.name).toBe('vmix_diagnose_audio');
    expect(brainTools[7]?.name).toBe('vmix_diagnose_outputs');
    expect(brainTools[8]?.name).toBe('vmix_generate_script');
    expect(brainTools[9]?.name).toBe('vmix_validate_script');
    expect(brainTools[10]?.name).toBe('vmix_generate_api_sequence');
    expect(brainTools[11]?.name).toBe('vmix_compare_xml_snapshots');
    expect(brainTools[12]?.name).toBe('vmix_read_preset_file');
    expect(brainTools[13]?.name).toBe('vmix_explain_preset_scripts');
    expect(brainTools[14]?.name).toBe('vmix_audit_preset_file');
    expect(brainTools[15]?.name).toBe('vmix_preflight');
    expect(brainTools[16]?.name).toBe('vmix_diagnose_logs');
    expect(brainTools[17]?.name).toBe('vmix_connection_test');
  });

  it('returns control tools without High-Impact Control opt-in', () => {
    const tools = getToolsForMode(true);

    expect(tools).toHaveLength(109);
    expect(tools.map((tool) => tool.name)).toContain('vmix_switch_cut');
    expect(tools.map((tool) => tool.name)).not.toContain('vmix_batch');
    expect(tools.map((tool) => tool.name)).not.toContain('vmix_record');
    expect(tools.map((tool) => tool.name)).not.toContain('vmix_stream');
    expect(tools.map((tool) => tool.name)).not.toContain('vmix_script_run');
  });

  it('returns all preserved tools when High-Impact Control is enabled', () => {
    expect(getToolsForMode(true, true)).toHaveLength(135);
  });

  it('registers only review tools in default review mode', () => {
    const server = createFakeServer();
    const ctx = createMockToolContext();
    ctx.config = createTestConfig({ VMIX_CONTROL_MODE: false });

    registerAllTools(server, ctx);

    expect(server.tool).toHaveBeenCalledTimes(18);
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_server_version',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_show_review',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_analyze_preset',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_generate_show_checklist',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_find_input',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_explain_input',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_diagnose_audio',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_diagnose_outputs',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_generate_script',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_validate_script',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_generate_api_sequence',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_compare_xml_snapshots',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_read_preset_file',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_explain_preset_scripts',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_audit_preset_file',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_preflight',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_diagnose_logs',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_connection_test',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('registers control tools when Control Mode is enabled', () => {
    const server = createFakeServer();
    const ctx = createMockToolContext();
    ctx.config = createTestConfig({ VMIX_CONTROL_MODE: true });

    registerAllTools(server, ctx);

    expect(server.tool).toHaveBeenCalledTimes(109);
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_switch_cut',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
    expect(server.tool).not.toHaveBeenCalledWith(
      'vmix_batch',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('registers all preserved control tools when High-Impact Control is enabled', () => {
    const server = createFakeServer();
    const ctx = createMockToolContext();
    ctx.config = createTestConfig({
      VMIX_CONTROL_MODE: true,
      VMIX_HIGH_IMPACT: true,
    });

    registerAllTools(server, ctx);

    expect(server.tool).toHaveBeenCalledTimes(135);
    expect(server.tool).toHaveBeenCalledWith(
      'vmix_batch',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });
});
