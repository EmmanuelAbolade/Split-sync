// src/services/appCheck.test.js
const mockInit = jest.fn();
jest.mock('firebase/app-check', () => ({
  initializeAppCheck: (...a) => mockInit(...a),
  ReCaptchaEnterpriseProvider: function ReCaptchaEnterpriseProvider(key) { this.key = key; },
}));

beforeEach(() => {
  jest.resetModules();
  mockInit.mockReset();
});

const load = () => require('./appCheck'); // fresh module state per test

test('does nothing without a site key (current production builds)', () => {
  expect(load().startAppCheck({}, { NODE_ENV: 'production' })).toBe(false);
  expect(mockInit).not.toHaveBeenCalled();
});

test('does nothing in tests even with a key', () => {
  expect(load().startAppCheck({}, { NODE_ENV: 'test', REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY: 'k' })).toBe(false);
});

test('starts once with the reCAPTCHA Enterprise provider and auto refresh', () => {
  const { startAppCheck } = load();
  const env = { NODE_ENV: 'production', REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY: 'site-key' };
  expect(startAppCheck({ name: 'app' }, env)).toBe(true);
  expect(startAppCheck({ name: 'app' }, env)).toBe(true);
  expect(mockInit).toHaveBeenCalledTimes(1);
  const [app, opts] = mockInit.mock.calls[0];
  expect(app).toEqual({ name: 'app' });
  expect(opts.provider.key).toBe('site-key');
  expect(opts.isTokenAutoRefreshEnabled).toBe(true);
});

test('a start-up error never breaks the app', () => {
  mockInit.mockImplementation(() => { throw new Error('bad key'); });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(load().startAppCheck({}, { NODE_ENV: 'production', REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY: 'k' })).toBe(false);
  warn.mockRestore();
});
