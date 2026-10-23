/**
 * The Orb Browser's top bar, in the Orbit look: a dark desk, hairlines, square line icons, one
 * underlined field. The field takes an address OR a goal for the orb; while the orb works, it
 * becomes the orb's status with a Stop button. Settings (the key, the model, how the orb behaves)
 * open as a sheet over the page.
 */
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './chrome.css';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ChromeState, OrbChrome } from '../chrome-preload';
import { looksLikeAddress } from '../address';

declare global {
  interface Window {
    orbChrome: OrbChrome;
  }
}
const api = window.orbChrome;

const ICONS = {
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  reload: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
  stop: 'M6 6l12 12M18 6 6 18',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6 6 18',
};
function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="square" strokeLinejoin="miter" aria-hidden focusable="false">
      <path d={d} />
    </svg>
  );
}

const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

function Settings({ state, onClose }: { state: ChromeState; onClose: () => void }) {
  const s = state.settings;
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const saveKey = async () => {
    const r = await api.setKey(key);
    setMsg(r.ok ? 'Saved. The orb can think now.' : (r.why ?? 'That did not work.'));
    if (r.ok) setKey('');
  };
  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet-head">
          <h1 id="settings-title">
            <em>Settings</em>
          </h1>
          <button type="button" className="icon" aria-label="Close settings" onClick={onClose}>
            <Icon d={ICONS.close} />
          </button>
        </header>

        <p className="kicker">Thinking</p>
        <div className="row col">
          <label htmlFor="key">Anthropic API key</label>
          <p className="hint">{state.keySaved ? 'A key is saved in this computer’s keychain.' : state.hasKey ? 'Using the key from ANTHROPIC_API_KEY.' : 'Without a key the orb still follows, types and can be thrown, but cannot think or drive.'}</p>
          <div className="inline">
            <input id="key" type="password" className="field" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} data-private />
            <button type="button" className="btn primary" disabled={!key.trim()} onClick={saveKey}>
              Save
            </button>
            {state.keySaved && (
              <button type="button" className="btn" onClick={() => void api.setKey(null).then(() => setMsg('Removed.'))}>
                Remove
              </button>
            )}
          </div>
          {msg && <p className="hint" role="status">{msg}</p>}
        </div>
        <div className="row">
          <span>Model</span>
          <Segmented label="Model" value={s.model} options={MODELS} onChange={(model) => api.setSettings({ model })} />
        </div>
        <div className="row">
          <span>Effort per step</span>
          <Segmented
            label="Effort"
            value={s.effort}
            options={[
              { id: 'low', label: 'Quick' },
              { id: 'medium', label: 'Balanced' },
              { id: 'high', label: 'Careful' },
            ]}
            onChange={(effort) => api.setSettings({ effort })}
          />
        </div>

        <p className="kicker">The orb</p>
        <div className="row">
          <span>Follows what matters</span>
          <Switch label="Follows what matters" on={s.follow} onChange={(follow) => api.setSettings({ follow })} />
        </div>
        <div className="row">
          <span>Sounds</span>
          <Switch label="Sounds" on={s.sound} onChange={(sound) => api.setSettings({ sound })} />
        </div>
        <div className="row">
          <span>Motion</span>
          <Segmented
            label="Motion"
            value={s.level}
            options={[
              { id: 'full', label: 'Full' },
              { id: 'lite', label: 'Lite' },
              { id: 'off', label: 'Off' },
            ]}
            onChange={(level) => api.setSettings({ level })}
          />
        </div>
        <div className="row">
          <span>Colours</span>
          <Segmented
            label="Colours"
            value={s.theme}
            options={[
              { id: 'dark', label: 'Dark' },
              { id: 'light', label: 'Light' },
            ]}
            onChange={(theme) => api.setSettings({ theme })}
          />
        </div>
        <p className="foot">
          Tap the orb to talk, hold it to open its panel, drag it onto a button to press it, drop it in a box to type there, throw it to a side to park it, pinch it to zoom the page. Type a goal in the address bar and it does it for you; press Escape or Stop to take over.
        </p>
      </section>
    </div>
  );
}

function App() {
  const [state, setState] = useState<ChromeState | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => api.onState(setState), []);
  useEffect(() => {
    if (!editing && state) setText(state.url);
  }, [state, editing]);
  useEffect(() => {
    document.documentElement.dataset.theme = state?.settings.theme ?? 'dark';
  }, [state?.settings.theme]);
  useEffect(() => {
    // Cmd/Ctrl+L: the address bar.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        field.current?.focus();
        field.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const openSettings = (on: boolean) => {
    setSettings(on);
    api.overlay(on);
  };
  if (!state) return <div className="bar" />;
  const isAddress = looksLikeAddress(text);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    api.go(text);
    setEditing(false);
    field.current?.blur();
  };
  return (
    <>
      <div className="bar" data-loading={state.loading || undefined}>
        <span className="mark" aria-hidden>
          Orb
        </span>
        <nav className="nav" aria-label="Page">
          <button type="button" className="icon" aria-label="Back" disabled={!state.canBack} onClick={api.back}>
            <Icon d={ICONS.back} />
          </button>
          <button type="button" className="icon" aria-label="Forward" disabled={!state.canForward} onClick={api.forward}>
            <Icon d={ICONS.forward} />
          </button>
          <button type="button" className="icon" aria-label={state.loading ? 'Stop loading' : 'Reload'} onClick={api.reload}>
            <Icon d={state.loading ? ICONS.stop : ICONS.reload} />
          </button>
        </nav>
        {state.driving ? (
          <div className="driving" role="status" aria-live="polite">
            <span className="pulse" aria-hidden />
            <p>
              <b>The orb is working on</b> {state.driving.goal}
              {state.driving.line && <span className="line"> · {state.driving.line}</span>}
            </p>
            <button type="button" className="btn" onClick={api.stop}>
              Stop
            </button>
          </div>
        ) : (
          <form className="omni" onSubmit={submit} role="search">
            <input
              ref={field}
              className="field"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={(e) => (setEditing(true), e.currentTarget.select())}
              onBlur={() => setEditing(false)}
              spellCheck={false}
              aria-label="Address, or tell the orb what to do"
              placeholder="Type an address, or tell the orb what to do"
            />
            {editing && text.trim() && <span className="hint-go">{isAddress ? '↵ Open' : '↵ Ask the orb'}</span>}
          </form>
        )}
        {!state.hasKey && (
          <button type="button" className="btn ghost" onClick={() => openSettings(true)}>
            Add a key
          </button>
        )}
        <button type="button" className="icon" aria-label="Settings" aria-expanded={settings} onClick={() => openSettings(!settings)}>
          <Icon d={ICONS.more} />
        </button>
      </div>
      {settings && <Settings state={state} onClose={() => openSettings(false)} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
