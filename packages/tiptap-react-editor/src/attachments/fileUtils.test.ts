import { describe, expect, it } from 'vitest';
import { formatFileSize, getFileExtension, isImageMime, validateFile } from './fileUtils';

const makeFile = (name: string, type: string, sizeBytes: number): File => {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
};

describe('formatFileSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('returns an empty string for null/NaN', () => {
    expect(formatFileSize(null)).toBe('');
    expect(formatFileSize(undefined)).toBe('');
    expect(formatFileSize(NaN)).toBe('');
  });
});

describe('getFileExtension', () => {
  it('uppercases the extension', () => {
    expect(getFileExtension('report.pdf')).toBe('PDF');
    expect(getFileExtension('archive.tar.gz')).toBe('GZ');
  });

  it('returns an empty string when there is no extension', () => {
    expect(getFileExtension('README')).toBe('');
  });
});

describe('isImageMime', () => {
  it('recognizes image/* mime types', () => {
    expect(isImageMime('image/png')).toBe(true);
    expect(isImageMime('application/pdf')).toBe(false);
    expect(isImageMime(null)).toBe(false);
  });
});

describe('validateFile', () => {
  const opts = { maxFileSizeMB: 1, acceptedFileTypes: ['.pdf', 'image/*'] };

  it('accepts a file matching an extension pattern', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 1024);
    expect(validateFile(file, opts)).toEqual({ valid: true, error: null });
  });

  it('accepts a file matching a MIME wildcard pattern', () => {
    const file = makeFile('photo.png', 'image/png', 1024);
    expect(validateFile(file, opts)).toEqual({ valid: true, error: null });
  });

  it('rejects a file whose type is not in the allowlist', () => {
    const file = makeFile('script.exe', 'application/x-msdownload', 1024);
    const result = validateFile(file, opts);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/isn't supported/i);
  });

  it('rejects a file over the size limit', () => {
    const file = makeFile('doc.pdf', 'application/pdf', 2 * 1024 * 1024);
    const result = validateFile(file, opts);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/1 MB limit/);
  });

  it('rejects a file with neither a MIME type nor a recognizable extension', () => {
    const file = makeFile('mystery', '', 100);
    const result = validateFile(file, opts);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/couldn't determine/i);
  });
});
