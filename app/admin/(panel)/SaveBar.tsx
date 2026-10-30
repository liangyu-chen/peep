'use client';

import { useEffect, useRef, useState } from 'react';

// Tells the save bar of the surrounding form that something changed ('dirty'),
// or what's wrong with it right now ('problem', '' when nothing is).
export function notify(from: Element | null, type: 'dirty' | 'problem', detail = '') {
  from?.closest('form')?.dispatchEvent(new CustomEvent(type, { detail }));
}

// The one save button for a whole page: sticks to the bottom, says whether there are unsaved changes,
// won't save while an editor reports a problem, can undo back to what's saved, and warns before leaving unsaved.
export default function SaveBar({ label = '儲存', readOnly = false, children }: { label?: string; readOnly?: boolean; children?: React.ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  const leaving = useRef(false), isDirty = useRef(false);

  useEffect(() => {
    const form = bar.current?.closest('form');
    if (!form) return;
    const mark = () => { isDirty.current = true; setDirty(true); };
    const onProblem = (e: Event) => setProblem((e as CustomEvent<string>).detail || '');
    const onSubmit = () => { leaving.current = true; setSaving(true); };
    const warn = (e: BeforeUnloadEvent) => { if (isDirty.current && !leaving.current) { e.preventDefault(); e.returnValue = ''; } };
    form.addEventListener('input', mark); form.addEventListener('change', mark); form.addEventListener('dirty', mark);
    form.addEventListener('problem', onProblem); form.addEventListener('submit', onSubmit);
    window.addEventListener('beforeunload', warn);
    return () => {
      form.removeEventListener('input', mark); form.removeEventListener('change', mark); form.removeEventListener('dirty', mark);
      form.removeEventListener('problem', onProblem); form.removeEventListener('submit', onSubmit);
      window.removeEventListener('beforeunload', warn);
    };
  }, []);

  const undo = () => { leaving.current = true; location.reload(); };
  return (
    <div ref={bar} className="save-bar">
      <span className={problem ? 'problem' : dirty ? 'unsaved' : 'muted'}>
        {readOnly ? '唯讀（還沒連上資料庫）' : problem || (dirty ? '有尚未儲存的修改' : '所有修改都已儲存')}
      </span>
      <span className="save-actions">
        {children}
        {dirty && <button type="button" onClick={undo} disabled={saving}>復原</button>}
        <button className="primary" disabled={readOnly || !dirty || !!problem || saving}>{saving ? '儲存中…' : label}</button>
      </span>
    </div>
  );
}
