// The e-reader — a book read in the browser, page by page.
//
// What this protects, said plainly, because it is easy to oversell:
// **a web page cannot stop a screenshot.** No browser gives a page that power,
// and anything that claims to is decoration. Somebody with the book open can
// photograph their screen and there is no defeating that from here.
//
// What it does do is remove every easy path to a copy, and make a deliberate
// one traceable:
//
//   - the PDF is not a URL any more. It comes through an endpoint that checks
//     the book is this reader's to read, and the bytes are fetched once as a
//     blob that never becomes a link;
//   - pages are drawn onto a canvas, so there is no file, no viewer chrome, no
//     download button and no "save as";
//   - every page carries the reader's own name, faintly, across the middle.
//     That is the part that actually changes behaviour: a photograph of a page
//     says who took it.
//
// The rest — the disabled right-click, the blocked print, the unselectable
// text — is friction rather than protection, and is treated as such.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { API_ORIGIN } from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { brand, slate, font, radius } from '../theme';

// Loaded on demand: pdf.js is large, and most visits to the reader app never
// open a book.
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export default function Reader() {
  const { id } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();

  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [dark, setDark] = useState(false);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  // 1. May this reader open it, and what name goes on the pages.
  useEffect(() => {
    let alive = true;
    api.get(`/ebook/${id}/info`)
      .then((r) => { if (alive) setInfo(r.data); })
      .catch((e) => { if (alive) setErr(e.response?.data?.error || t('msg.opFailed')); });
    return () => { alive = false; };
  }, [id, t]);

  // 2. Fetch the bytes through the API — with the token, so the server can
  //    refuse — and hand them straight to pdf.js. They are never turned into
  //    an object URL, because that is a link somebody can open in a new tab.
  useEffect(() => {
    if (!info?.allowed) return undefined;
    let alive = true;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const res = await fetch(`${API_ORIGIN}/api/ebook/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('fetch');
        const buf = await res.arrayBuffer();
        if (!alive) return;
        const loaded = await pdfjs.getDocument({ data: buf }).promise;
        if (alive) setDoc(loaded);
      } catch {
        if (alive) setErr(t('mrb.read.failed'));
      }
    })();
    return () => { alive = false; };
  }, [info, id, t]);

  // 3. Draw the current page, then the watermark over it. Drawing the mark
  //    onto the same canvas is deliberate: it cannot be removed by hiding an
  //    element, because it is part of the pixels.
  const render = useCallback(async () => {
    if (!doc || !canvasRef.current) return;
    const p = await doc.getPage(page);
    const wrapW = wrapRef.current?.clientWidth || 800;
    const base = p.getViewport({ scale: 1 });
    const scale = ((wrapW - 24) / base.width) * zoom;
    const viewport = p.getViewport({ scale });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';

    await p.render({ canvasContext: ctx, viewport, canvas }).promise;

    if (info?.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = dark ? '#ffffff' : '#0F172A';
      ctx.font = `600 ${Math.max(16, viewport.width / 26)}px ${font.ui}`;
      ctx.textAlign = 'center';
      ctx.translate(viewport.width / 2, viewport.height / 2);
      ctx.rotate(-Math.PI / 7);
      // Twice, so cropping out the middle of a page does not lose it.
      ctx.fillText(info.watermark, 0, -viewport.height / 5);
      ctx.fillText(info.watermark, 0, viewport.height / 5);
      ctx.restore();
    }
  }, [doc, page, zoom, info, dark]);

  useEffect(() => { render(); }, [render]);
  useEffect(() => {
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [render]);

  // Arrow keys turn pages, which is what a book should do.
  useEffect(() => {
    if (!doc) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPage((n) => Math.min(doc.numPages, n + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPage((n) => Math.max(1, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc]);

  const shell = {
    minHeight: '100vh', fontFamily: font.ui,
    background: dark ? '#0B1220' : slate.bg,
    color: dark ? '#E2E8F0' : slate.text,
    display: 'flex', flexDirection: 'column',
  };

  if (err || (info && !info.allowed)) {
    return (
      <div style={{ ...shell, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          maxWidth: 420, textAlign: 'center', background: '#fff', color: slate.text,
          border: '1px solid ' + slate.border, borderRadius: radius.card, padding: 28,
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📕</div>
          <h1 style={{ margin: '0 0 8px', fontSize: 19 }}>{t('mrb.read.cannot')}</h1>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: slate.body, lineHeight: 1.5 }}>
            {err || t('mrb.read.notYours')}
          </p>
          <button onClick={() => nav(-1)} style={btn(true)}>{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={shell}
      // Friction, not protection — and labelled as such in this file's header.
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`
        @media print { body { display: none !important; } }
        .mrb-reader canvas { user-select: none; -webkit-user-drag: none; pointer-events: none; }
      `}</style>

      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: dark ? 'rgba(11,18,32,.92)' : 'rgba(255,255,255,.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid ' + (dark ? '#1E293B' : slate.border),
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <button onClick={() => nav(-1)} style={btn(false, dark)}>← {t('common.back')}</button>
        <strong style={{
          flex: '1 1 160px', minWidth: 0, fontSize: 15,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{info?.title || ''}</strong>

        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            style={btn(false, dark)} aria-label={t('mrb.read.zoomOut')}>−</button>
          <span style={{ fontSize: 12, minWidth: 42, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
            style={btn(false, dark)} aria-label={t('mrb.read.zoomIn')}>+</button>
          <button onClick={() => setDark((d) => !d)} style={btn(false, dark)}>
            {dark ? '☀' : '☾'}
          </button>
        </span>
      </header>

      <main ref={wrapRef} className="mrb-reader" style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '20px 12px 96px', gap: 12,
      }}>
        {!doc ? (
          <div style={{ padding: 60, fontSize: 14, color: dark ? '#94A3B8' : slate.dim }}>
            {t('common.loading')}
          </div>
        ) : (
          <canvas ref={canvasRef} style={{
            borderRadius: 10, maxWidth: '100%',
            boxShadow: dark ? '0 8px 30px rgba(0,0,0,.6)' : '0 8px 30px rgba(15,23,42,.14)',
            background: '#fff',
          }} />
        )}
      </main>

      {doc && (
        <nav style={{
          position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 20,
          background: dark ? 'rgba(15,23,42,.96)' : 'rgba(255,255,255,.96)',
          border: '1px solid ' + (dark ? '#1E293B' : slate.border),
          borderRadius: 999, padding: '8px 12px',
          boxShadow: '0 10px 30px rgba(15,23,42,.18)',
        }}>
          <button onClick={() => setPage((n) => Math.max(1, n - 1))}
            disabled={page <= 1} style={btn(false, dark)}>‹</button>
          <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', minWidth: 78, textAlign: 'center' }}>
            {t('mrb.read.pageOf', { n: page, total: doc.numPages })}
          </span>
          <button onClick={() => setPage((n) => Math.min(doc.numPages, n + 1))}
            disabled={page >= doc.numPages} style={btn(false, dark)}>›</button>
        </nav>
      )}

      {/* Said out loud rather than hidden: the reader knows their name is on
          the page. That is the point — a deterrent nobody notices deters
          nobody. */}
      {info?.watermark && doc && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 20,
          fontSize: 11, color: dark ? '#64748B' : slate.muted, maxWidth: 260, textAlign: 'right',
        }}>{t('mrb.read.watermarked', { name: info.watermark })}</div>
      )}
    </div>
  );
}

function btn(primary, dark) {
  return {
    background: primary ? brand.primary : (dark ? '#1E293B' : '#fff'),
    color: primary ? '#fff' : (dark ? '#E2E8F0' : slate.text),
    border: primary ? 0 : '1px solid ' + (dark ? '#334155' : slate.border),
    borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}
