/**
 * Runs in every page the Orb Browser shows, in the preload's isolated world: the page's own scripts
 * cannot reach the orb's code or this bridge, only see its <orb-companion> element. It mounts the orb
 * and connects it to the main process:
 *   - the orb's brain is a proxy: questions stream from main (brain:chat), goals go to main's pilot
 *     (pilot:start), so a goal survives this page being replaced by the next one;
 *   - main calls the orb's hands (orb:call → look, perform, confirm, ask, say, log, setDriving…)
 *     and gets answers back (orb:reply).
 */
import { ipcRenderer } from 'electron';
import { mountOrb, type MountedOrb } from '../src/embed/mount';
import type { OrbBrain, OrbHandle, OrbSettings } from '../src/orb/OrbCursor';
import type { Step } from '../src/pilot/types';
import { canSpeak, webSpeech } from '../src/brains/webSpeech';

let chatSeq = 0;
const streams = new Map<number, (delta: string) => void>();
ipcRenderer.on('brain:delta', (_e, id: number, delta: string) => streams.get(id)?.(delta));

// Speaking answers works in Electron; listening (Web Speech recognition) does not, so a tap opens the panel.
const voice: Pick<OrbBrain, 'speak'> = canSpeak() ? webSpeech() : {};

const brain: OrbBrain = {
  why: 'I need an API key to think. Add one in Settings (the ⋯ button at the top right).',
  ready: () => ipcRenderer.invoke('brain:ready'),
  async chat(messages, onText, signal) {
    const id = ++chatSeq;
    streams.set(id, onText);
    const abort = () => ipcRenderer.send('brain:abort', id);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      await ipcRenderer.invoke('brain:chat', id, messages);
    } finally {
      streams.delete(id);
      signal?.removeEventListener('abort', abort);
    }
  },
  speak: voice.speak,
  drive(goal, _hands, signal) {
    // The loop runs in main; this page's part ends when main says so (or the page goes away).
    return new Promise<void>((resolve) => {
      ipcRenderer.once('pilot:end', () => resolve());
      signal.addEventListener('abort', () => ipcRenderer.send('pilot:stop'), { once: true });
      ipcRenderer.send('pilot:start', goal);
    });
  },
};

let orb: MountedOrb | null = null;
let handle: OrbHandle | null = null;
/** The step being done now: main can abort it. */
let stepCtrl: AbortController | null = null;
let textScale = 1;

async function dispatch(method: string, args: unknown[]): Promise<unknown> {
  const h = handle!;
  switch (method) {
    case 'look':
      return h.hands.look();
    case 'perform': {
      stepCtrl?.abort();
      const ctrl = (stepCtrl = new AbortController());
      try {
        return await h.hands.perform(args[0] as Step, ctrl.signal);
      } finally {
        if (stepCtrl === ctrl) stepCtrl = null;
      }
    }
    case 'abort':
      stepCtrl?.abort();
      return null;
    case 'confirm':
      return h.hands.confirm(String(args[0]));
    case 'ask':
      return h.hands.ask(String(args[0]));
    case 'say':
      h.say(String(args[0]));
      return null;
    case 'log':
      h.hands.log?.(String(args[0]));
      return null;
    case 'setDriving': {
      const goal = args[0] as string | null;
      h.setDriving(goal ? { goal, stop: () => ipcRenderer.send('pilot:stop') } : null);
      return null;
    }
    case 'settings': {
      const [s, zoom] = args as [OrbSettings & { theme?: 'dark' | 'light' }, number];
      textScale = zoom || 1;
      const { theme, ...rest } = s;
      orb?.update({ settings: { ...rest, textScale }, theme: theme ?? 'dark' });
      return null;
    }
    case 'open':
      h.open();
      return null;
    default:
      throw new Error(`The orb has no “${method}”.`);
  }
}

ipcRenderer.on('orb:call', async (_e, id: number, method: string, args: unknown[]) => {
  try {
    if (!handle) throw new Error('The orb is not on this page yet.');
    ipcRenderer.send('orb:reply', id, true, await dispatch(method, args));
  } catch (err) {
    ipcRenderer.send('orb:reply', id, false, (err as Error).message);
  }
});

function start() {
  if (orb || !document.documentElement) return;
  orb = mountOrb({
    brain,
    settings: { follow: true, sound: true, level: 'full', textScale },
    onTextScale: (s) => {
      textScale = s;
      ipcRenderer.send('orb:zoom', s);
    },
    placeholder: 'Ask me, or tell me what to do here…',
    // Only the end-to-end tests open the shadow root (to press the orb's own buttons).
    shadowMode: process.argv.includes('--orb-test') ? 'open' : 'closed',
  });
  void orb.ready.then((h) => {
    handle = h;
    ipcRenderer.send('orb:ready', location.href);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
