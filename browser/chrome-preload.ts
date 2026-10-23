/**
 * The bridge for the browser's own top bar (browser/chrome). It exposes only these calls; the bar
 * has no other way into the main process.
 */
import { contextBridge, ipcRenderer } from 'electron';

export interface ChromeState {
  url: string;
  title: string;
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
  driving: { goal: string; line: string | null } | null;
  lastLine: string;
  hasKey: boolean;
  keySaved: boolean;
  settings: { model: string; effort: 'low' | 'medium' | 'high'; follow: boolean; sound: boolean; level: 'full' | 'lite' | 'off'; theme: 'dark' | 'light' };
}

const api = {
  go: (text: string) => ipcRenderer.send('chrome:go', text),
  back: () => ipcRenderer.send('chrome:back'),
  forward: () => ipcRenderer.send('chrome:forward'),
  reload: () => ipcRenderer.send('chrome:reload'),
  drive: (goal: string) => ipcRenderer.send('chrome:drive', goal),
  stop: () => ipcRenderer.send('chrome:stop'),
  overlay: (on: boolean) => ipcRenderer.send('chrome:overlay', on),
  setSettings: (next: Partial<ChromeState['settings']>) => ipcRenderer.send('chrome:settings', next),
  setKey: (key: string | null): Promise<{ ok: boolean; why?: string }> => ipcRenderer.invoke('chrome:key', key),
  openExternal: (url: string) => ipcRenderer.send('chrome:open-external', url),
  onState(cb: (s: ChromeState) => void) {
    const on = (_e: unknown, s: ChromeState) => cb(s);
    ipcRenderer.on('chrome:state', on);
    ipcRenderer.send('chrome:state?');
    return () => void ipcRenderer.removeListener('chrome:state', on);
  },
};

export type OrbChrome = typeof api;
contextBridge.exposeInMainWorld('orbChrome', api);
