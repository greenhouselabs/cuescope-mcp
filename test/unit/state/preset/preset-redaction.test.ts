import { describe, it, expect } from 'vitest';
import { redactSecrets, redactPresetFile } from '../../../../src/state/preset/preset-redaction.js';
import type { PresetFile } from '../../../../src/state/preset/preset-types.js';
import { PRESET_FRESHNESS_NOTE } from '../../../../src/state/preset/preset-types.js';

describe('redactSecrets', () => {
  it('masks element-wrapped sensitive values', () => {
    expect(redactSecrets('<Google_API_Key>AIzaABC</Google_API_Key>')).toBe('<Google_API_Key>[redacted]</Google_API_Key>');
  });
  it('masks assignment-form secrets', () => {
    expect(redactSecrets('Password="hunter2" passphrase=ppX')).toBe('Password="[redacted]" passphrase=[redacted]');
  });
  it('does NOT redact a bare <Key> (input GUID)', () => {
    const guid = '<Key>8e211845-684d-43cd-b5af-cabb00e4a00f</Key>';
    expect(redactSecrets(guid)).toBe(guid);
  });
  it('leaves ordinary text untouched', () => {
    expect(redactSecrets('SetText Input=1 Value=Hello')).toBe('SetText Input=1 Value=Hello');
  });
  it('does NOT redact a vMix Key:= named argument', () => {
    const code = 'API.Function("SetVolumeFade", Input:="Cam", Key:="fadein", Value:="2000")';
    expect(redactSecrets(code)).toBe(code);
  });
  it('preserves the colon in := for real secrets', () => {
    expect(redactSecrets('token:=abc123')).toBe('token:=[redacted]');
  });
  it('masks a stream key embedded in a URL query string', () => {
    expect(redactSecrets('rtmp://host/app?key=topsecret')).toBe('rtmp://host/app?key=[redacted]');
  });
  it('masks the full quoted value when the secret contains & or spaces', () => {
    expect(redactSecrets('password="p&ssw0rd"')).toBe('password="[redacted]"');
    expect(redactSecrets('streamkey="abc def&xyz"')).toBe('streamkey="[redacted]"');
    expect(redactSecrets('Password:="top & secret"')).toBe('Password:="[redacted]"');
  });
  it('treats & as a boundary for unquoted values (VB concatenation operator)', () => {
    // Quoted secrets are masked in full; unquoted values stop at '&' so VB
    // concatenation and query-string structure are never swallowed.
    expect(redactSecrets('password=p&ssw0rd')).toBe('password=[redacted]&ssw0rd');
  });
  it('masks adjacent quoted secrets independently', () => {
    const out = redactSecrets('password="a&b" token="c d"');
    expect(out).toBe('password="[redacted]" token="[redacted]"');
  });
  it('masks URL credentials of the form scheme://user:secret@host', () => {
    expect(redactSecrets('rtmp://alice:s3cr3t@live.example.com/app')).toBe(
      'rtmp://alice:[redacted]@live.example.com/app'
    );
    expect(redactSecrets('srt://user:p@ss@host:9000')).toBe('srt://user:[redacted]@host:9000');
  });
  it('does not mistake a host:port URL for credentials', () => {
    const url = 'http://localhost:8088/api/?Function=Cut';
    expect(redactSecrets(url)).toBe(url);
  });
  it('masks other secret names in URL query strings without eating the rest of the query', () => {
    expect(redactSecrets('https://x/app?password=abc&next=1')).toBe(
      'https://x/app?password=[redacted]&next=1'
    );
  });
});

describe('redactPresetFile', () => {
  it('redacts secrets in script source and returns a copy', () => {
    const preset: PresetFile = {
      meta: { path: null, modifiedAt: null, presetVersion: '9', source: 'saved preset file', freshnessNote: PRESET_FRESHNESS_NOTE },
      scripts: [{ name: 'Stream', source: 'API.Function "StartStreaming", Value:="rtmp://x?key=topsecret"' }],
      inputs: [],
      dataSources: [],
    };
    const out = redactPresetFile(preset);
    expect(out.scripts[0]!.source).not.toContain('topsecret');
    expect(preset.scripts[0]!.source).toContain('topsecret'); // original untouched
  });

  it('redacts saved vMix Call keys while preserving non-secret audio metadata', () => {
    const preset: PresetFile = {
      meta: { path: null, modifiedAt: null, presetVersion: '9', source: 'saved preset file', freshnessNote: PRESET_FRESHNESS_NOTE },
      scripts: [],
      inputs: [
        {
          key: '{guest-key}',
          title: 'Remote Guest',
          type: '6000',
          audio: {
            muted: false,
            buses: ['A'],
            busMaster: false,
            busFlags: { A: true },
          },
          videoCall: {
            key: 'SECRET_CALL_KEY',
            hasKey: true,
            returnAudioIndex: 4,
            returnVideoName: 'Output 3',
            serverMode: 'True',
            bandwidthProfile: 'HD',
            guestBandwidth: '1200',
          },
          triggers: [],
          titleMetadata: null,
        },
      ],
      dataSources: [],
    };

    const out = redactPresetFile(preset);

    expect(out.inputs[0]!.videoCall?.key).toBe('[redacted]');
    expect(out.inputs[0]!.videoCall?.hasKey).toBe(true);
    expect(out.inputs[0]!.audio).toMatchObject({ buses: ['A'], busFlags: { A: true } });
    expect(preset.inputs[0]!.videoCall?.key).toBe('SECRET_CALL_KEY');

    out.inputs[0]!.audio!.buses.push('C');
    expect(preset.inputs[0]!.audio!.buses).toEqual(['A']);
  });

  it('redacts title metadata values while preserving structure', () => {
    const preset: PresetFile = {
      meta: { path: null, modifiedAt: null, presetVersion: '9', source: 'saved preset file', freshnessNote: PRESET_FRESHNESS_NOTE },
      scripts: [],
      inputs: [
        {
          key: '{title-key}',
          title: 'Preshow',
          type: '22',
          audio: null,
          videoCall: null,
          triggers: [],
          titleMetadata: {
            hasCountdownXml: true,
            hasDataSourcesXml: true,
            countdownSettings: [
              {
                fieldName: 'Countdown.Text',
                startTime: '00:00:00',
                duration: null,
                format: null,
                reverse: null,
                reverseDisplay: null,
                autoStart: false,
                loop: false,
                actionAtEnd: 'token=SECRET_TOKEN',
                rawValues: { ActionAtEnd: 'token=SECRET_TOKEN' },
              },
            ],
            dataSourceBindings: [
              {
                fieldName: 'Countdown.Text',
                instanceId: null,
                dataSource: 'Default',
                table: 'Default',
                column: 'Auto',
                row: -1,
                rawValues: { Value: 'apikey=SECRET_KEY' },
              },
            ],
          },
        },
      ],
      dataSources: [],
    };

    const out = redactPresetFile(preset);

    expect(out.inputs[0]!.titleMetadata?.countdownSettings[0]!.actionAtEnd).toBe('token=[redacted]');
    expect(out.inputs[0]!.titleMetadata?.countdownSettings[0]!.rawValues.ActionAtEnd).toBe('token=[redacted]');
    expect(out.inputs[0]!.titleMetadata?.dataSourceBindings[0]!.rawValues.Value).toBe('apikey=[redacted]');
  });
});
