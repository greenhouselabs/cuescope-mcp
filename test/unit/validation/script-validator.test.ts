/**
 * Tests for VB.NET script validator
 */

import { describe, it, expect } from 'vitest';
import { validateVmixScript, VMIX_SCRIPT_PATTERNS } from '../../../src/validation/index.js';

describe('validateVmixScript', () => {
  describe('errors', () => {
    it('rejects Thread.Sleep', () => {
      const script = `
        Thread.Sleep(1000)
        API.Function("Cut", Input:="1")
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Sleep()');
    });

    it('rejects == comparison', () => {
      const script = `
        Dim x As String = "test"
        If x == "test" Then
          API.Function("Cut")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('=='))).toBe(true);
    });

    it('rejects != comparison', () => {
      const script = `
        If status != "Running" Then
          API.Function("Play")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('<>'))).toBe(true);
    });

    it('rejects == without surrounding whitespace', () => {
      const script = `
        Dim x As String = "test"
        If x=="test" Then
          API.Function("Cut")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('=='))).toBe(true);
    });

    it('rejects != without surrounding whitespace', () => {
      const script = `
        If status !="Running" Then
          API.Function("Play")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('<>'))).toBe(true);
    });

    it('does not flag == inside a string literal', () => {
      const script = `
        Dim op As String = "=="
        If op = "==" Then
          API.Function("Cut")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.errors.some((e) => e.includes('=='))).toBe(false);
    });

    it('does not flag == inside a VB comment', () => {
      const script = `
        ' C# would write x == y here, but VB uses =
        If x = "test" Then
          API.Function("Cut")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.errors.some((e) => e.includes('=='))).toBe(false);
    });

    it('rejects var declarations', () => {
      const script = `
        var x = "test"
        API.Function("Cut")
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Dim'))).toBe(true);
    });

    it('rejects infinite loop without Sleep', () => {
      const script = `
        Do While True
          API.Function("Cut", Input:="1")
        Loop
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('FREEZE'))).toBe(true);
    });

    it('accepts loop with Sleep', () => {
      const script = `
        Do While True
          API.Function("Cut", Input:="1")
          Sleep(100)
        Loop
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts loop with Sleep when comments mention loop before the sleep', () => {
      const script = `
        Do While True
          API.Function("Cut", Input:="1")
          ' This loop is intentionally paced below.
          Sleep(100)
        Loop
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects multiple errors', () => {
      const script = `
        var x = "test"
        If x == "test" Then
          Thread.Sleep(1000)
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('warnings', () => {
    it('warns about + for string concatenation', () => {
      const script = `
        Dim name As String = "John"
        Dim greeting As String = "Hello " + name
        Sleep(100)
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('&'))).toBe(true);
    });

    it('warns about very long Sleep', () => {
      const script = `
        Sleep(120000)
        API.Function("Cut")
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('very long'))).toBe(true);
    });

    it('warns about Console.WriteLine', () => {
      const script = `
        Console.WriteLine("Debug")
        API.Function("Cut")
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('Console'))).toBe(true);
    });
  });

  describe('valid scripts', () => {
    it('accepts correct VB.NET syntax', () => {
      const script = `
        ' Camera rotation script
        Dim cameras As String() = {"Camera 1", "Camera 2", "Camera 3"}
        Dim index As Integer = 0

        Do While True
          API.Function("Cut", Input:=cameras(index))
          index = (index + 1) Mod cameras.Length
          Sleep(5000)
        Loop
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts script with XML state reading', () => {
      const script = `
        Dim xml As String = API.XML()
        Dim x As New System.Xml.XmlDocument
        x.LoadXml(xml)

        Dim active As String = x.SelectSingleNode("//active").InnerText

        If active = "1" Then
          API.Function("Cut", Input:="2")
        End If
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
    });

    it('accepts single-line If statements', () => {
      const script = `
        Dim x As Integer = 5
        If x = 5 Then API.Function("Cut")
      `;
      const result = validateVmixScript(script);

      expect(result.valid).toBe(true);
    });
  });
});

describe('VMIX_SCRIPT_PATTERNS', () => {
  describe('apiCall', () => {
    it('generates simple call', () => {
      const result = VMIX_SCRIPT_PATTERNS.apiCall('Cut', {});
      expect(result).toBe('API.Function("Cut")');
    });

    it('generates call with params', () => {
      const result = VMIX_SCRIPT_PATTERNS.apiCall('Cut', { Input: 'Camera 1' });
      expect(result).toBe('API.Function("Cut", Input:="Camera 1")');
    });

    it('generates call with multiple params', () => {
      const result = VMIX_SCRIPT_PATTERNS.apiCall('SetText', {
        Input: 'Lower Third',
        SelectedName: 'Name.Text',
        Value: 'John',
      });
      expect(result).toContain('Input:="Lower Third"');
      expect(result).toContain('SelectedName:="Name.Text"');
      expect(result).toContain('Value:="John"');
    });
  });

  describe('declare', () => {
    it('generates declaration without value', () => {
      expect(VMIX_SCRIPT_PATTERNS.declare('x', 'String')).toBe('Dim x As String');
    });

    it('generates declaration with value', () => {
      expect(VMIX_SCRIPT_PATTERNS.declare('x', 'String', '"test"')).toBe(
        'Dim x As String = "test"'
      );
    });
  });

  describe('sleep', () => {
    it('generates Sleep call', () => {
      expect(VMIX_SCRIPT_PATTERNS.sleep(1000)).toBe('Sleep(1000)');
    });
  });

  describe('safeLoop', () => {
    it('generates loop with Sleep', () => {
      const result = VMIX_SCRIPT_PATTERNS.safeLoop('API.Function("Cut")', 200);
      expect(result).toContain('Do While True');
      expect(result).toContain('API.Function("Cut")');
      expect(result).toContain('Sleep(200)');
      expect(result).toContain('Loop');

      // Should be valid
      expect(validateVmixScript(result).valid).toBe(true);
    });
  });
});
