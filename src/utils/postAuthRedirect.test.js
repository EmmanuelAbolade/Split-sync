// src/utils/postAuthRedirect.test.js
import { isSafeInternalPath, rememberRedirect, peekRedirect, clearRedirect } from './postAuthRedirect';

beforeEach(() => sessionStorage.clear());

describe('isSafeInternalPath', () => {
  test.each([
    '/invite/abc123',
    '/group/xyz',
    '/dashboard',
    '/activity?filter=owe',
  ])('accepts in-app path %s', (p) => expect(isSafeInternalPath(p)).toBe(true));

  test.each([
    ['protocol-relative', '//evil.com'],
    ['backslash trick', '/\\evil.com'],
    ['absolute URL', 'https://evil.com/invite/1'],
    // eslint-disable-next-line no-script-url -- deliberately unsafe input
    ['javascript URL', 'javascript:alert(1)'],
    ['relative path', 'invite/1'],
    ['root only', '/'],
    ['login loop', '/login'],
    ['register loop', '/register?x=1'],
    ['forgot-password loop', '/forgot-password'],
    ['control character', '/invite/1\nSet-Cookie'],
    ['too long', '/' + 'a'.repeat(600)],
    ['non-string', 42],
    ['null', null],
  ])('rejects %s', (_label, p) => expect(isSafeInternalPath(p)).toBe(false));

  test('does not treat look-alike paths as auth pages', () => {
    expect(isSafeInternalPath('/loginhelp')).toBe(true);
  });
});

describe('remember / peek / clear', () => {
  test('falls back to /dashboard when nothing is remembered', () => {
    expect(peekRedirect()).toBe('/dashboard');
  });

  test('remembers a safe path and peeking does not clear it', () => {
    rememberRedirect('/invite/g1');
    expect(peekRedirect()).toBe('/invite/g1');
    expect(peekRedirect()).toBe('/invite/g1');
  });

  test('clearRedirect forgets the target', () => {
    rememberRedirect('/invite/g1');
    clearRedirect();
    expect(peekRedirect()).toBe('/dashboard');
  });

  test('ignores unsafe paths when remembering', () => {
    rememberRedirect('//evil.com');
    expect(peekRedirect()).toBe('/dashboard');
  });

  test('a tampered stored value is never returned', () => {
    sessionStorage.setItem('splitsync.postAuthRedirect', 'https://evil.com');
    expect(peekRedirect()).toBe('/dashboard');
  });

  test('works when sessionStorage throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(peekRedirect()).toBe('/dashboard');
    spy.mockRestore();
  });
});
