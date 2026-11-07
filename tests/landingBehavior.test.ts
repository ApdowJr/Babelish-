/**
 * Behavioural checks for the framework-free landing page.  A small fake DOM
 * lets the normal Node test runner exercise app.js without a browser dependency.
 * Layout, real CSS transitions and the CSP should also be checked in a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const source = readFileSync(path.join(process.cwd(), 'site/app.js'), 'utf8');
const css = readFileSync(path.join(process.cwd(), 'site/styles.css'), 'utf8');
const html = readFileSync(path.join(process.cwd(), 'site/index.html'), 'utf8');
const apk = 'https://github.com/ApdowJr/Babelish-/releases/latest/download/babelish.apk';
const releases = 'https://github.com/ApdowJr/Babelish-/releases';

class Tokens {
  private values = new Set<string>();
  add(...tokens: string[]) { tokens.forEach((token) => this.values.add(token)); }
  remove(...tokens: string[]) { tokens.forEach((token) => this.values.delete(token)); }
  contains(token: string) { return this.values.has(token); }
  toggle(token: string, force?: boolean) {
    const enabled = force === undefined ? !this.values.has(token) : force;
    if (enabled) this.values.add(token);
    else this.values.delete(token);
    return enabled;
  }
}

type EventCallback = (event: any) => void;
class ElementStub {
  readonly classList = new Tokens();
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, EventCallback[]>();
  readonly children = new Set<ElementStub>();
  bar: ElementStub | null = null;
  textContent = '';
  innerHTML = '';
  hidden = false;
  focused = false;
  offsetWidth = 100;
  lang = 'en';

  constructor(attributes: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(attributes)) this.attributes.set(key, value);
  }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  addEventListener(name: string, callback: EventCallback) {
    const callbacks = this.listeners.get(name) ?? [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }
  fire(name: string, detail: Record<string, unknown> = {}) {
    const event = { target: this, relatedTarget: null, ...detail };
    for (const callback of this.listeners.get(name) ?? []) callback(event);
  }
  querySelector(selector: string) {
    return selector === '.step-progress i' ? this.bar : null;
  }
  contains(element: ElementStub | null) {
    return element === this || (element !== null && this.children.has(element));
  }
  focus() { this.focused = true; }
}

class Clock {
  now = 0;
  private nextId = 1;
  readonly pending = new Map<number, { at: number; callback: () => void }>();
  setTimeout = (callback: () => void, delay: number) => {
    const id = this.nextId++;
    this.pending.set(id, { at: this.now + delay, callback });
    return id;
  };
  clearTimeout = (id: number) => { this.pending.delete(id); };
  advance(ms: number) {
    const until = this.now + ms;
    while (true) {
      const next = [...this.pending.entries()]
        .filter(([, task]) => task.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at;
      this.pending.delete(next[0]);
      next[1].callback();
    }
    this.now = until;
  }
}

type Options = {
  landing?: boolean;
  reducedMotion?: boolean;
  observeVisibility?: boolean;
  storedLanguage?: string;
  status?: number;
  assets?: { name: string; size?: number }[];
  offline?: boolean;
};

function makePage(options: Options = {}) {
  const landing = options.landing !== false;
  const clock = new Clock();
  const storage = new Map<string, string>();
  if (options.storedLanguage) storage.set('babelish-lang', options.storedLanguage);
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  };

  const root = new ElementStub();
  const header = new ElementStub();
  const menu = new ElementStub({ 'aria-expanded': 'false', 'data-i18n-aria-label': 'a11y.menu' });
  const theme = new ElementStub({ 'data-i18n-aria-label': 'a11y.theme' });
  const langButtons = ['en', 'so'].map((lang) => new ElementStub({ 'data-lang': lang }));
  const title = new ElementStub({ 'data-i18n': 'hero.title' });
  const demoControl = new ElementStub({ 'data-i18n': 'how.pause' });
  demoControl.hidden = true;
  const demoRegion = new ElementStub();
  const how = new ElementStub();
  const steps = [0, 1, 2].map((index) => {
    const step = new ElementStub({ 'data-step': String(index) });
    step.bar = new ElementStub();
    demoRegion.children.add(step);
    return step;
  });
  const demoSteps = [0, 1, 2].map((index) => {
    const step = new ElementStub({ 'data-step': String(index) });
    demoRegion.children.add(step);
    return step;
  });
  const screens = [new ElementStub(), new ElementStub(), new ElementStub()];
  const links = [new ElementStub({ href: apk }), new ElementStub({ href: apk })];
  const note = new ElementStub();
  note.hidden = true;
  const size = new ElementStub();
  const metaSize = new ElementStub();
  const description = new ElementStub();
  const year = new ElementStub();
  const metas = [new ElementStub(), new ElementStub()];
  header.children.add(menu);

  const one: Record<string, ElementStub> = landing
    ? {
        '#apk-link': links[0],
        '#theme-toggle': theme,
        '.site-header': header,
        '#menu-btn': menu,
        '#how': how,
        '.how-grid': demoRegion,
        '#demo-control': demoControl,
        '#apk-note': note,
        '#apk-size': size,
        '#meta-size': metaSize,
        '#year': year,
        'meta[name="description"]': description,
      }
    : { '#year': year, 'meta[name="description"]': description };

  const documentListeners = new Map<string, EventCallback[]>();
  const document = {
    documentElement: root,
    title: landing ? 'Babelish' : 'Privacy policy — Babelish',
    hidden: false,
    visibilityState: 'visible',
    querySelector: (selector: string) => one[selector] ?? null,
    querySelectorAll: (selector: string) => {
      if (selector === 'meta[name="theme-color"]') return metas;
      if (!landing) return [];
      if (selector === '[data-i18n]') return [title, demoControl];
      if (selector === '[data-i18n-aria-label]') return [theme, menu];
      if (selector === '.lang-btn') return langButtons;
      if (selector === '.how-step') return steps;
      if (selector === '.demo-step') return demoSteps;
      if (selector === '.how-stage .screen') return screens;
      if (selector === `a[href="${apk}"]`) return links.filter((link) => link.getAttribute('href') === apk);
      return [];
    },
    addEventListener: (name: string, callback: EventCallback) => {
      const callbacks = documentListeners.get(name) ?? [];
      callbacks.push(callback);
      documentListeners.set(name, callbacks);
    },
    fire: (name: string, detail: Record<string, unknown> = {}) => {
      for (const callback of documentListeners.get(name) ?? []) callback(detail);
    },
  };

  const observers: { emit: (visible: boolean) => void }[] = [];
  class ObserverStub {
    private target: ElementStub | null = null;
    constructor(private callback: (entries: { target: ElementStub | null; isIntersecting: boolean }[]) => void) {
      observers.push({ emit: (visible) => this.callback([{ target: this.target, isIntersecting: visible }]) });
    }
    observe(target: ElementStub) { this.target = target; }
    unobserve() {}
  }

  let fetchCalls = 0;
  const fetch = async () => {
    fetchCalls += 1;
    if (options.offline) throw new Error('offline');
    const status = options.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => ({ assets: options.assets ?? [{ name: 'babelish.apk', size: 47_638_517 }] }),
    };
  };
  const windowStub: Record<string, unknown> = {
    scrollY: 0,
    fetch,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    addEventListener: () => {},
    matchMedia: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? !!options.reducedMotion : query.includes('hover: hover'),
      addEventListener: () => {},
    }),
  };
  if (options.observeVisibility) windowStub.IntersectionObserver = ObserverStub;
  class FakeDate extends Date {
    constructor() { super('2026-11-07T00:00:00Z'); }
    static now() { return clock.now; }
  }
  runInNewContext(source, {
    document,
    window: windowStub,
    navigator: { language: 'en' },
    localStorage,
    fetch,
    Date: FakeDate,
    IntersectionObserver: ObserverStub,
  }, { timeout: 1000 });

  return {
    document, root, header, menu, theme, langButtons, title, demoControl, demoRegion,
    steps, demoSteps, screens, links, note, size, metaSize, observers, clock, storage,
    getFetchCalls: () => fetchCalls,
  };
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('the walkthrough synchronizes controls and pauses its timer and progress', async () => {
  const page = makePage({ observeVisibility: true });
  await settle();
  assert.equal(page.clock.pending.size, 0, 'off-screen walkthrough should not run');
  page.observers[0].emit(true);
  page.clock.advance(2000);
  page.demoRegion.fire('mouseenter');
  assert.ok(page.steps[0].bar!.classList.contains('is-paused'));
  page.clock.advance(10_000);
  assert.ok(page.steps[0].classList.contains('is-on'), 'hover pauses the current step');
  page.demoRegion.fire('mouseleave');
  page.clock.advance(3599);
  assert.ok(page.steps[0].classList.contains('is-on'), 'remaining time is preserved');
  page.clock.advance(1);
  assert.ok(page.steps[1].classList.contains('is-on'));
  assert.equal(page.demoSteps[1].getAttribute('aria-pressed'), 'true');
  assert.ok(page.screens[1].classList.contains('is-active'));

  page.demoControl.fire('click');
  assert.equal(page.demoControl.textContent, 'Play demo');
  page.demoSteps[2].fire('click');
  page.clock.advance(12_000);
  assert.ok(page.steps[2].classList.contains('is-on'), 'explicit pause survives manual selection');
  assert.ok(page.screens[2].classList.contains('is-active'));
  page.demoControl.fire('click');
  assert.equal(page.demoControl.textContent, 'Pause demo');
  page.clock.advance(5600);
  assert.ok(page.steps[0].classList.contains('is-on'), 'play resumes at the next step');

  page.demoRegion.fire('focusin');
  page.clock.advance(6000);
  assert.ok(page.steps[0].classList.contains('is-on'), 'keyboard focus pauses the demo');
  page.demoRegion.fire('focusout', { relatedTarget: null });
  page.observers[0].emit(false);
  page.clock.advance(6000);
  assert.ok(page.steps[0].classList.contains('is-on'), 'leaving the section pauses the demo');
});

test('reduced-motion visitors can navigate manually without autoplay', async () => {
  const page = makePage({ reducedMotion: true });
  await settle();
  assert.equal(page.demoControl.hidden, true);
  assert.equal(page.clock.pending.size, 0);
  page.demoSteps[1].fire('click');
  assert.ok(page.screens[1].classList.contains('is-active'));
  assert.equal(page.steps[1].getAttribute('aria-pressed'), 'true');
  page.clock.advance(60_000);
  assert.ok(page.steps[1].classList.contains('is-on'));
});

test('language, theme and mobile menu retain accessible state', async () => {
  const page = makePage();
  await settle();
  page.langButtons[1].fire('click');
  assert.equal(page.root.lang, 'so');
  assert.equal(page.storage.get('babelish-lang'), 'so');
  assert.equal(page.theme.getAttribute('aria-label'), 'Beddel muuqaalka');
  page.theme.fire('click');
  assert.equal(page.root.getAttribute('data-theme'), 'dark');
  assert.equal(page.theme.getAttribute('aria-pressed'), 'true');
  assert.equal(page.storage.get('babelish-theme'), 'dark');

  page.menu.fire('click');
  assert.equal(page.menu.getAttribute('aria-expanded'), 'true');
  page.document.fire('keydown', { key: 'Escape' });
  assert.equal(page.menu.getAttribute('aria-expanded'), 'false');
  assert.ok(page.menu.focused, 'Escape returns focus to the menu button');
  page.menu.fire('click');
  page.document.fire('click', { target: new ElementStub() });
  assert.equal(page.menu.getAttribute('aria-expanded'), 'false', 'an outside click closes the menu');
});

test('APK fallback distinguishes a missing asset from network and API failures', async () => {
  for (const options of [{ status: 404 }, { assets: [{ name: 'other.apk' }] }]) {
    const page = makePage(options);
    await settle();
    assert.equal(page.note.hidden, false);
    assert.equal(page.links[0].getAttribute('href'), releases);
    assert.equal(page.links[1].getAttribute('href'), releases);
  }
  for (const options of [{ status: 403 }, { status: 500 }, { offline: true }]) {
    const page = makePage(options);
    await settle();
    assert.equal(page.note.hidden, true);
    assert.equal(page.links[0].getAttribute('href'), apk);
  }
  const available = makePage();
  await settle();
  assert.equal(available.size.textContent, '~45 MB');
  assert.equal(available.metaSize.textContent, '~45 MB');
});

test('legal pages keep their own metadata, English language and layout', async () => {
  const page = makePage({ landing: false, storedLanguage: 'so' });
  await settle();
  assert.equal(page.root.lang, 'en');
  assert.equal(page.document.title, 'Privacy policy — Babelish');
  assert.equal(page.getFetchCalls(), 0, 'legal pages do not need the APK API request');
  for (const selector of ['.legal-page', '.legal-table-wrap', '.legal-link']) {
    assert.ok(css.includes(selector), `${selector} must stay styled`);
  }
});

test('demo screens are marked as illustrations and retain accessible controls', () => {
  assert.match(html, /Illustrative previews inspired by Babelish/);
  const buttons = [...html.matchAll(/<button[^>]*class="demo-step(?: is-on)?"[^>]*\saria-label="([^"]+)"[^>]*>(\d{2})<\/button>/g)];
  assert.equal(buttons.length, 3);
  for (const [, label, visible] of buttons) {
    assert.ok(label.includes(visible), `accessible label must include the visible number ${visible}`);
  }
  assert.match(html, /id="demo-control"[^>]*hidden/);
  assert.match(html, /<noscript>[\s\S]*preview is static without JavaScript/i);
  assert.equal([...html.matchAll(/class="how-step(?: is-on)?"[^>]*disabled>/g)].length, 3);
  assert.match(html, /<pre tabindex="0"[^>]*data-i18n-aria-label="a11y.buildCommands"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.ok(!/\.style\s*\./.test(source), 'the strict CSP does not allow JS-written inline styles');
});
