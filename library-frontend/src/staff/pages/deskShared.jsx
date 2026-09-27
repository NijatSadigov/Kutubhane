// The two pieces the circulation screens share once Holds & overdue splits in
// two: the toast every screen raises, and the due-date dialog that both the
// loans list and (in future) the desk need.

import { useState } from 'react';
import api from '../../api/axios';
import { ink } from '../theme';
import { Btn, Input } from '../components/StaffShell';
import { Dialog } from './InventoryDialogs';

export function Toast({ children }) {
  if (!children) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
      background: '#0F172A', color: '#fff', padding: '11px 18px', borderRadius: 12,
      fontSize: 13, fontWeight: 600, zIndex: 100,
    }}>{children}</div>
  );
}

// Changing a due date is the one action the design never gave the desk. A
// librarian has always been able to, and there is no other way to extend a loan
// for a reader who asks.
export function DueDateDialog({ loan, t, say, onClose, onSaved }) {
  const iso = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');
  const [due, setDue] = useState(iso(loan.due_date));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!due) return;
    setBusy(true);
    try {
      await api.put(`/loans/${loan.id}`, { due_date: due });
      say(t('staff.holds.dueSaved'));
      onSaved();
    } catch (e) {
      say(e.response?.data?.error || t('msg.opFailed'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog title={t('staff.holds.changeDue')} onClose={onClose} t={t}>
      <div style={{ fontSize: 13, color: ink.body, marginTop: -8 }}>
        {loan.book_copy?.book?.title} · {loan.student?.name}
      </div>
      <label style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        fontSize: 12, fontWeight: 600, color: ink.strong,
      }}>
        {t('staff.col.due')}
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn kind="secondary" onClick={onClose}>{t('common.cancel')}</Btn>
        <Btn onClick={save} disabled={busy || !due}>{t('common.save')}</Btn>
      </div>
    </Dialog>
  );
}
