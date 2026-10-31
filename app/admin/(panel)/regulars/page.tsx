import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_REGULARS, faceOf, FACE, HAIR_STYLES, HAT_STYLES, hairOf, hatOf } from '@/src/content/catalog';

const toHex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const label = (list: { value: string; label: string }[], v: string) => list.find(o => o.value === v)?.label ?? v;

export default async function RegularsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows = db
    ? await db.select().from(schema.regulars).orderBy(asc(schema.regulars.sort), asc(schema.regulars.id))
    : DEFAULT_REGULARS.map((r, i) => ({ ...r, id: -1 - i, sort: i, active: true }));

  return (
    <>
      <h1>熟客</h1>
      <p className="hint">
        店裡大約四分之三的客人是熟客，熟客會點自己的常點、用自己的主隊打 2K。點「編輯 · 捏臉」可以改資料和長相，右邊有 3D 預覽。
        取消「啟用」的熟客不會再來店裡；第一次來的新客是隨機產生的，到「新客隨機值」維護。
      </p>
      {msg && <p className="note ok">{msg}</p>}

      <div className="reg-list">
        {rows.map(r => {
          const f = faceOf(r.look, r.name);
          return (
            <Link key={r.id} href={db ? `/admin/regulars/${r.id}` : '#'} className={`reg-item${r.active ? '' : ' off'}`}>
              <span className="swatch big" style={{ background: toHex(r.look.shirt) }} aria-hidden>
                <i style={{ background: toHex(r.look.skin) }} />
              </span>
              <span className="who">
                <b>{r.name}</b>{!r.active && <span className="badge mute">停用</span>}
                <span className="muted">{r.job} · 常點 {r.drink}</span>
                <span className="muted">{[r.plays2k && `2K（${r.team || '隨機'}）`, r.playsFight && `快打旋風（${r.fighter || '隨機'}）`, r.playsTops && '戰鬥陀螺', r.smokes && '抽菸'].filter(Boolean).join(' · ') || '不打電動'}</span>
                <span className="muted">{label(HAIR_STYLES, hairOf(r.look))}{hatOf(r.look).hat !== 'none' ? `＋${label(HAT_STYLES, hatOf(r.look).hat)}` : ''} · {label(FACE.faceShape, f.faceShape)} · {label(FACE.eyes, f.eyes)}</span>
              </span>
              <span className="go">編輯 · 捏臉 →</span>
            </Link>
          );
        })}
      </div>
      <p><Link href="/admin/regulars/new" className="button primary">＋ 新增熟客</Link></p>
    </>
  );
}
