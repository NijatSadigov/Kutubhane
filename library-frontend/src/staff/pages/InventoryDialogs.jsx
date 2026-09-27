// The inventory dialogs: edit a title, add or edit a physical copy, and the
// CSV bulk import.
//
// None of these appear in `Staff Console.dc.html` — the design's inventory
// screen only adds a title and lists copies read-only. The working system has
// always let a librarian manage copies, swap a cover, attach an e-book and
// import a spreadsheet, and dropping those in the migration would be a
// regression. They are built in the staff design system's language: 16px
// modal over a #082F49 55% scrim, 13px controls on #CBD5E1 borders.

import { useEffect, useState } from 'react';
import api, { assetUrl } from '../../api/axios';
import { shell, ink, radius, font } from '../theme';
import { Btn, Input, Alert } from '../components/StaffShell';

/* ------------------------------------------------- shared dialog chrome */

export function Dialog({ title, onClose, children, wide, t }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(8,47,73,0.55)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: wide ? 720 : 560, background: '#fff', borderRadius: radius.modal,
        padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 24px 64px rgba(15,23,42,0.35)', maxHeight: '86vh', overflowY: 'auto',
        fontFamily: font.ui,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
          <Btn kind="secondary" onClick={onClose} style={{ padding: '5px 10px' }}
            aria-label={t('common.close')}>✕</Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      fontSize: 12, fontWeight: 600, color: ink.strong,
    }}>{label}{children}</label>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
      padding: '8px 10px', fontSize: 13, background: '#fff', color: ink.text,
      fontFamily: 'inherit', cursor: 'pointer',
    }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function Row({ children }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10,
    }}>{children}</div>
  );
}

function Footer({ danger, onClose, onSave, saveLabel, busy, t }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      {danger || <span />}
      <span style={{ display: 'flex', gap: 8 }}>
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={onSave} disabled={busy}>{saveLabel}</Btn>
      </span>
    </div>
  );
}

/* --------------------------------------------------------- edit a title */

// What a branch may change about its own holding: shelf mark, genre, and the
// cover or e-book it serves. Title and author belong to the shared catalogue
// and are deliberately not editable here — changing them would rewrite the
// record every other school sees.
export function EditTitle({ book, t, say, onClose, onSaved }) {
  const [callNo, setCallNo] = useState(book.call_no || '');
  const [genreId, setGenreId] = useState(book.genre_id ? String(book.genre_id) : '');
  const [genres, setGenres] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState('');

  useEffect(() => {
    api.get('/genres').then((r) => setGenres(r.data || [])).catch(() => {});
  }, []);

  const upload = async (kind, file) => {
    if (!file) return;
    setUploading(kind);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload/' + kind, form);
      const url = res.data?.url || res.data?.path;
      await api.put('/books/' + book.id, kind === 'cover' ? { cover_url: url } : { ebook_url: url });
      say(t('staff.inv.uploaded'));
      onSaved();
    } catch { say(t('msg.opFailed')); }
    finally { setUploading(''); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/books/' + book.id, {
        call_no: callNo.trim(),
        genre_id: genreId ? Number(genreId) : null,
      });
      say(t('staff.inv.saved'));
      onSaved();
    } catch { say(t('msg.opFailed')); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete('/books/' + book.id);
      say(t('staff.inv.deleted'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('staff.inv.deleteBlocked'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={book.title} onClose={onClose} t={t}>
      <div style={{ fontSize: 12, color: ink.dim, marginTop: -8 }}>{t('staff.inv.editHint')}</div>

      <Row>
        <Field label={t('staff.inv.callNo')}>
          <Input value={callNo} onChange={(e) => setCallNo(e.target.value)} />
        </Field>
        <Field label={t('staff.col.genre')}>
          <Select value={genreId} onChange={setGenreId} options={genres}
            placeholder={t('staff.inv.noGenre')} />
        </Field>
      </Row>

      <Row>
        <Field label={t('staff.inv.cover')}>
          <input type="file" accept="image/*" disabled={!!uploading}
            onChange={(e) => upload('cover', e.target.files?.[0])} style={{ fontSize: 12 }} />
        </Field>
        <Field label={t('staff.inv.ebook')}>
          <input type="file" accept="application/pdf" disabled={!!uploading}
            onChange={(e) => upload('ebook', e.target.files?.[0])} style={{ fontSize: 12 }} />
        </Field>
      </Row>

      {book.ebook_url ? (
        <a href={assetUrl(book.ebook_url)} target="_blank" rel="noreferrer"
          style={{ fontSize: 13, fontWeight: 700, color: '#075985' }}>
          {t('staff.inv.openEbook')} →
        </a>
      ) : null}

      <Footer
        danger={<Btn kind="danger" onClick={remove} disabled={busy}>{t('staff.inv.deleteTitle')}</Btn>}
        onClose={onClose} onSave={save} saveLabel={t('common.save')} busy={busy} t={t}
      />
    </Dialog>
  );
}

/* --------------------------------------------------- add or edit a copy */

export function EditCopy({ book, copy, t, say, onClose, onSaved }) {
  const isNew = !copy;
  const [tracking, setTracking] = useState(copy?.tracking_number || '');
  const [conditionId, setConditionId] = useState(copy?.condition_id ? String(copy.condition_id) : '');
  const [statusId, setStatusId] = useState(copy?.status_id ? String(copy.status_id) : '');
  const [conditions, setConditions] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/copy-conditions').then((r) => setConditions(r.data || [])).catch(() => {});
    api.get('/copy-statuses').then((r) => {
      const list = r.data || [];
      setStatuses(list);
      // A copy with no status counts as neither available nor on loan: it
      // vanishes from the availability bar and cannot be lent. A new copy is
      // on the shelf unless the librarian says otherwise.
      if (isNew) {
        const free = list.find((x) => x.code === 'AVAILABLE');
        if (free) setStatusId((cur) => cur || String(free.id));
      }
    }).catch(() => {});
  }, [isNew]);

  const save = async () => {
    if (!tracking.trim()) { say(t('staff.inv.needBarcode')); return; }
    setBusy(true);
    const body = {
      book_id: book.id,
      tracking_number: tracking.trim(),
      condition_id: conditionId ? Number(conditionId) : null,
      status_id: statusId ? Number(statusId) : null,
    };
    try {
      if (isNew) await api.post('/books/copy', body);
      else await api.put('/copy/' + copy.id, body);
      say(isNew ? t('staff.inv.copyAdded') : t('staff.inv.saved'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete('/copy/' + copy.id);
      say(t('staff.inv.copyDeleted'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('staff.inv.copyDeleteBlocked'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={isNew ? t('staff.inv.addCopy') : t('staff.inv.editCopy')} onClose={onClose} t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8 }}>{book.title}</div>

      <Field label={t('staff.inv.barcode')}>
        <Input value={tracking} onChange={(e) => setTracking(e.target.value)} autoFocus
          style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} />
      </Field>

      <Row>
        <Field label={t('staff.desk.condition')}>
          <Select value={conditionId} onChange={setConditionId} options={conditions}
            placeholder={t('staff.inv.noCondition')} />
        </Field>
        <Field label={t('staff.col.status')}>
          <Select value={statusId} onChange={setStatusId} options={statuses}
            placeholder={t('staff.inv.noStatus')} />
        </Field>
      </Row>

      <Footer
        danger={isNew ? null
          : <Btn kind="danger" onClick={remove} disabled={busy}>{t('staff.inv.deleteCopy')}</Btn>}
        onClose={onClose} onSave={save}
        saveLabel={isNew ? t('common.add') : t('common.save')} busy={busy} t={t}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------ CSV bulk upload */

// The librarian's spreadsheet import. It goes through the same catalogue
// resolver as the add-a-title flow, so an import cannot desync the shared
// catalogue — which it silently did until that was fixed.
export function BulkUpload({ t, say, onClose, onDone }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const pick = async (file) => {
    if (!file) return;
    setText(await file.text());
  };

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.post('/books/bulk', { csv: text });
      setResult(res.data);
      say(t('staff.inv.bulkDone'));
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={t('staff.inv.bulkUpload')} onClose={onClose} wide t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8, lineHeight: 1.5 }}>
        {t('staff.inv.bulkHint')}
      </div>

      <input type="file" accept=".csv,text/csv"
        onChange={(e) => pick(e.target.files?.[0])} style={{ fontSize: 13 }} />

      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={10}
        placeholder="title,author,genre,isbn,publisher,year,pages,language,cefr,copies"
        style={{
          width: '100%', border: '1px solid ' + shell.control, borderRadius: radius.control,
          padding: '10px 12px', fontSize: 12, outline: 'none', resize: 'vertical',
          fontFamily: 'ui-monospace, Menlo, monospace', color: ink.text, boxSizing: 'border-box',
        }}
      />

      {result && (
        <Alert tone={result.failed ? 'action' : 'done'}>
          {t('staff.inv.bulkResult', { added: result.added ?? 0, failed: result.failed ?? 0 })}
        </Alert>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="secondary" onClick={result ? onDone : onClose}>
          {result ? t('common.close') : t('common.cancel')}
        </Btn>
        <Btn onClick={send} disabled={busy || !text.trim()}>{t('staff.inv.bulkSend')}</Btn>
      </div>
    </Dialog>
  );
}
