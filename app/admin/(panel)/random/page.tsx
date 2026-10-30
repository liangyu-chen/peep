import { asc } from 'drizzle-orm';
import { requireAdmin } from '@/src/lib/auth';
import { getDb, schema } from '@/src/lib/db';
import { DEFAULT_POOLS, POOLS } from '@/src/content/catalog';
import { saveRandomValues } from '../../actions';
import PoolsEditor from './PoolsEditor';
import SaveBar from '../SaveBar';

export default async function RandomPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = getDb();
  const rows = db
    ? await db.select().from(schema.randomValues).orderBy(asc(schema.randomValues.sort), asc(schema.randomValues.id))
    : POOLS.flatMap(p => DEFAULT_POOLS[p.key].map(value => ({ id: null as number | null, pool: p.key, value, active: true })));
  const pools = POOLS.map(p => ({ ...p, rows: rows.filter(r => r.pool === p.key).map(({ id, value, active }) => ({ id, value, active })) }));
  const active = (key: string) => rows.filter(r => r.pool === key && r.active).map(r => r.value);
  const [sur, f, m] = [active('surname'), active('titleF'), active('titleM')];
  const sample = sur.length && (f.length || m.length) ? [...sur.slice(0, 3).map(s => s + (f[0] ?? m[0])), ...sur.slice(0, 2).map(s => s + (m[0] ?? f[0]))] : [];

  return (
    <>
      <h1>新客隨機值</h1>
      <p className="hint">
        第一次來的客人是隨機組出來的：名字 =「姓氏」+「稱呼」，外加一個「身分」。這裡維護每一欄可以抽到的值，改完按最下面「儲存」一次存好。
        某一欄沒有任何啟用的值時，會改用預設值。
      </p>
      {sample.length > 0 && <p className="hint">目前可能出現的名字，例如：{sample.join('、')}⋯</p>}
      {msg && <p className="note ok">{msg}</p>}
      <form action={saveRandomValues}>
        <PoolsEditor key={Date.now()} pools={pools} readOnly={!db} />
        <SaveBar label="儲存" readOnly={!db} />
      </form>
    </>
  );
}
