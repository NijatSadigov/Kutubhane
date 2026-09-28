// Yeni dərslik sorğusu — the teacher asking the library for a class set.
//
// Pick the class, pick the titles, say how many of each and when. The whole
// point is that it should take one press for the ordinary case: choosing a
// class fills the basket with that grade's textbooks at one copy per child,
// which is what an initial request almost always is. Everything is then
// editable, because the extra mid-year ask for a single replacement is the
// same form.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useTranslation } from '../../i18n/LanguageContext';
import { shell, ink, radius, font } from '../theme';
import { Card, Btn, Input, Label, Alert, PageIntro } from '../components/StaffShell';
import { Toast } from './deskShared';

const KINDS = ['INITIAL', 'EXTRA', 'REPLACEMENT'];

function isoPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function NewTextbookRequest() {
  const { t } = useTranslation();
  const nav = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [books, setBooks] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [kind, setKind] = useState('INITIAL');
  const [qty, setQty] = useState({});          // textbook id -> count
  const [pickupOn, setPickupOn] = useState(isoPlus(3));
  const [returnBy, setReturnBy] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 3000); }, []);

  useEffect(() => {
    let alive = true;
    api.get('/classrooms').then((r) => { if (alive) setRooms(r.data || []); }).catch(() => {});
    api.get('/textbooks').then((r) => { if (alive) setBooks(r.data || []); }).catch(() => {});
    api.get('/academic-years').then((r) => {
      if (!alive) return;
      const cur = (r.data || []).find((y) => y.is_current);
      if (cur?.ends_on) setReturnBy(String(cur.ends_on).slice(0, 10));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const room = rooms.find((r) => String(r.id) === String(roomId));
  const forGrade = useMemo(
    () => books.filter((b) => !room || b.grade === room.grade),
    [books, room],
  );

  // Choosing a class prefills one copy per child of everything for that grade.
  const chooseRoom = (id) => {
    setRoomId(id);
    const r = rooms.find((x) => String(x.id) === String(id));
    if (!r) return;
    const next = {};
    if (kind === 'INITIAL') {
      books.filter((b) => b.grade === r.grade)
        .forEach((b) => { next[b.id] = r.student_count || 0; });
    }
    setQty(next);
  };

  const total = useMemo(
    () => Object.values(qty).reduce((n, v) => n + (Number(v) || 0), 0),
    [qty],
  );
  const chosen = useMemo(
    () => Object.entries(qty).filter(([, v]) => Number(v) > 0), [qty],
  );

  // Asking for more than the shelf holds is allowed — the library will trim it
  // and say so — but the teacher should see it coming.
  const over = useMemo(() => forGrade.filter(
    (b) => (Number(qty[b.id]) || 0) > b.available_copies,
  ), [forGrade, qty]);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/textbook-requests', {
        classroom_id: Number(roomId),
        kind,
        pickup_on: pickupOn || undefined,
        return_by: returnBy || undefined,
        note: note.trim(),
        lines: chosen.map(([id, v]) => ({ textbook_id: Number(id), qty: Number(v) })),
      });
      say(t('staff.tbnew.sent', { n: data.total_books }));
      setQty({});
      setNote('');
      setTimeout(() => nav('/staff/textbooks/requests'), 900);
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
      setBusy(false);
    }
  };

  const ready = roomId && chosen.length > 0;

  return (
    <>
      <PageIntro>{t('staff.tbnew.sub')}</PageIntro>

      {rooms.length === 0 && <Alert tone="action">{t('staff.cls.noClasses')}</Alert>}

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* 1 — the class */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.tbnew.step1')}</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {rooms.map((r) => {
                const on = String(r.id) === String(roomId);
                return (
                  <button key={r.id} onClick={() => chooseRoom(r.id)} style={chip(on)}>
                    {r.label}
                    <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 6 }}>
                      {t('staff.tbnew.nChildren', { n: r.student_count })}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 — what kind of ask */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.tbnew.step2')}</Label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {KINDS.map((k) => (
                <button key={k} onClick={() => setKind(k)} style={chip(kind === k)}>
                  {t('staff.tbreq.kind.' + k)}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: ink.dim }}>
              {t('staff.tbnew.kindHint.' + kind)}
            </span>
          </div>

          {/* 3 — the books */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>{t('staff.tbnew.step3', { n: total })}</Label>
            {!roomId ? (
              <span style={{ fontSize: 13, color: ink.dim }}>{t('staff.tbnew.pickClassFirst')}</span>
            ) : forGrade.length === 0 ? (
              <Alert tone="action">{t('staff.tbnew.noBooksForGrade', { n: room?.grade })}</Alert>
            ) : (
              <div style={{
                border: '1px solid ' + shell.border, borderRadius: radius.card, overflow: 'hidden',
              }}>
                {forGrade.map((b) => {
                  const v = qty[b.id] ?? '';
                  const short = (Number(v) || 0) > b.available_copies;
                  return (
                    <div key={b.id} style={{
                      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 110px',
                      gap: 10, alignItems: 'center', padding: '9px 14px',
                      borderBottom: '1px solid ' + shell.rowLine, fontSize: 13,
                    }}>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.title}
                        </strong>
                        <span style={{ fontSize: 11, color: ink.dim }}>
                          {b.subject?.name || '—'}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: short ? '#92400E' : ink.dim }}>
                        {t('staff.tb.freeN', { n: b.available_copies })}
                      </span>
                      <Input type="number" min={0} value={v}
                        onChange={(e) => setQty({ ...qty, [b.id]: e.target.value })}
                        style={{ padding: '5px 8px' }} />
                    </div>
                  );
                })}
              </div>
            )}
            {over.length > 0 && (
              <Alert tone="action">{t('staff.tbnew.overStock', { n: over.length })}</Alert>
            )}
          </div>

          {/* 4 — the dates */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>{t('staff.tbnew.pickupOn')}</Label>
              <Input type="date" value={pickupOn} onChange={(e) => setPickupOn(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>{t('staff.tbnew.returnBy')}</Label>
              <Input type="date" value={returnBy} onChange={(e) => setReturnBy(e.target.value)} />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label>{t('staff.tbnew.note')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={t('staff.tbnew.noteHint')} />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: ink.dim }}>
              {t('staff.tbnew.summary', { books: chosen.length, copies: total })}
            </span>
            <Btn onClick={submit} disabled={busy || !ready}>{t('staff.tbnew.send')}</Btn>
          </div>
        </div>
      </Card>

      <Toast>{toast}</Toast>
    </>
  );
}

function chip(on) {
  return {
    display: 'flex', alignItems: 'center',
    background: on ? '#082F49' : '#fff', color: on ? '#fff' : ink.body,
    border: '1px solid ' + (on ? '#082F49' : shell.control),
    borderRadius: radius.control, padding: '8px 14px',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: font.ui,
  };
}
