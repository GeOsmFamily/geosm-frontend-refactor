import { TruncatePipe } from './truncate.pipe';

describe('TruncatePipe', () => {
  let pipe: TruncatePipe;

  beforeEach(() => {
    pipe = new TruncatePipe();
  });

  it('should create', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return empty string for null', () => {
    expect(pipe.transform(null as any)).toBe('');
  });

  it('should not truncate short strings', () => {
    expect(pipe.transform('hello', 10)).toBe('hello');
  });

  it('should truncate long strings', () => {
    const result = pipe.transform('This is a very long string', 10);
    expect(result.length).toBeLessThanOrEqual(13); // 10 + '...'
    expect(result).toContain('...');
  });

  it('should use default limit of 50', () => {
    const longStr = 'A'.repeat(60);
    const result = pipe.transform(longStr);
    expect(result).toContain('...');
  });
});
