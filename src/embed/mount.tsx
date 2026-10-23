/**
 * The orb on ANY page: a website, a page in the Orb Browser, a page you do not own. It lives in a
 * closed shadow root under one <orb-companion> element on <html>, so the page's CSS cannot reach it
 * and its CSS cannot reach the page. The few page-level rules it needs (orb-page.css: the hover
 * outline, the press, hiding the field's own caret) are added to the document once.
 *
 *   const orb = mountOrb({ brain });       // returns at once
 *   const handle = await orb.ready;        // OrbHandle: hands, say, setDriving, open, close
 *   orb.update({ settings: { sound: true } });
 *   orb.unmount();
 */
import { createRoot, type Root } from 'react-dom/client';
import { OrbCursor, type OrbBrain, type OrbCursorProps, type OrbHandle } from '../orb/OrbCursor';
import faceCss from '../orb/face.css';
import orbCss from '../orb/orb.css';
import pageCss from '../orb/orb-page.css';

export interface MountOptions extends Omit<OrbCursorProps, 'brain' | 'onReady'> {
  brain?: OrbBrain | null;
  /** Where to attach the host element (default: <html>, so a page replacing <body> keeps the orb). */
  parent?: Element;
  /** 'closed' (default) keeps page scripts out of the orb; 'open' lets tests and devtools look inside. */
  shadowMode?: ShadowRootMode;
}

export interface MountedOrb {
  /** Resolves once the orb is drawn, with what a host can do with it. */
  ready: Promise<OrbHandle>;
  /** Re-render with changed props (settings, brain, theme…). */
  update(next: Partial<MountOptions>): void;
  unmount(): void;
  /** The <orb-companion> element on the page. */
  host: HTMLElement;
}

const PAGE_STYLE_ID = 'orb-companion-page-css';

export function mountOrb(options: MountOptions = {}): MountedOrb {
  if (!document.getElementById(PAGE_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = PAGE_STYLE_ID;
    style.textContent = pageCss;
    (document.head ?? document.documentElement).appendChild(style);
  }

  const host = document.createElement('orb-companion');
  // Out of the page's flow and untouched by its CSS; the layer inside is position: fixed.
  host.setAttribute('style', 'all: initial; position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483000;');
  const shadow = host.attachShadow({ mode: options.shadowMode ?? 'closed' });
  const style = document.createElement('style');
  style.textContent = `${faceCss}\n${orbCss}`;
  const mountPoint = document.createElement('div');
  shadow.append(style, mountPoint);
  const parent = options.parent ?? document.documentElement;
  parent.appendChild(host);

  // Some pages rebuild the whole document tree; put the orb back if it was removed.
  const keep = new MutationObserver(() => {
    if (!host.isConnected) parent.appendChild(host);
  });
  keep.observe(parent, { childList: true });

  let resolveReady!: (h: OrbHandle) => void;
  const ready = new Promise<OrbHandle>((r) => (resolveReady = r));
  let props: MountOptions = options;
  const root: Root = createRoot(mountPoint);
  const render = () => {
    const { parent: _parent, shadowMode: _mode, brain = null, ...rest } = props;
    void _parent;
    void _mode;
    root.render(<OrbCursor {...rest} brain={brain} onReady={resolveReady} />);
  };
  render();

  return {
    ready,
    host,
    update(next) {
      props = { ...props, ...next };
      render();
    },
    unmount() {
      keep.disconnect();
      root.unmount();
      host.remove();
    },
  };
}
