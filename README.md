# 窺視珈琲 3D

3D 的窺視珈琲小店（Next.js + three.js），加上可以編輯菜單和台詞的後台，資料存在 Neon。

- `/`：咖啡廳本體，每次載入都讀最新的菜單和台詞
- `/admin`：後台（菜單、台詞、新客姓名），用 `ADMIN_PASSWORD` 登入；前台右上角有「後台登入」連結
- `/api/content`：目前的菜單、台詞和新客姓名（JSON），`source` 會顯示資料來自 `db` 還是 `defaults`

沒設定資料庫時，網站照樣能跑，用的是 `src/content/catalog.ts` 裡的預設內容。

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入 DATABASE_URL、ADMIN_PASSWORD、SESSION_SECRET
npm run db:push              # 在 Neon 建立資料表
npm run db:seed              # 匯入預設菜單和台詞（只填空的表）
npm run dev
```

`npm run db:reset` 會清空三張表再重新匯入預設值，後台改過的內容會全部消失。

## 部署到 Vercel

1. 把專案推上 GitHub，在 Vercel 匯入。
2. 在 Vercel → Settings → Environment Variables 設定：
   - `DATABASE_URL`：Neon 的連線字串（建議用 pooled 那條）
   - `ADMIN_PASSWORD`：後台密碼，跟本機的不要一樣
   - `SESSION_SECRET`：至少 16 個字元的隨機字串，例如 `openssl rand -hex 32` 的結果
3. 部署前在本機對正式資料庫跑一次 `npm run db:push` 和 `npm run db:seed`。之後如果資料表有新增（例如新客姓名），再跑一次這兩個指令即可，既有資料不會被動到。

## 內容的規則

- 某個台詞情境在資料庫裡一句都沒有 → 用預設台詞
- 情境裡的台詞全部取消「啟用」→ 這個情境不說話
- 菜單沒有任何上架品項 → 用預設菜單
- 價格留白 → 紙菜單上顯示 `$???`，模擬營收用隨機金額
- 熟客的「常點」被下架了 → 改點菜單上的其他飲料
- 新客姓名沒有任何啟用的 → 用預設名單（陳小姐、陳先生⋯）；性別決定髮型，「不限」隨機

台詞可用的變數（每個情境可用哪些，後台會標出來）：`{name}` 客人名字、`{drink}` 飲料、`{team}` 球隊、`{opponent}` 對手名字。

## 程式結構

```
app/                 Next.js 頁面：前台、後台、API、server actions
src/content/         菜單和台詞的分類與預設值
src/db/schema.ts     Drizzle 資料表
src/lib/             資料庫連線、讀取內容、後台登入
src/cafe/            3D 場景（瀏覽器端）
  index.js           startCafe(root, content)：啟動並回傳關閉函式
  world/             建築、店內擺設、騎樓、後場、燈光
  people.js          人物模型與動作
  sim.js             老闆和客人的行為、營業時間
  tv.js              電視上的 2K 比賽
  hud.js             介面、視角、點選人物
scripts/seed.ts      匯入預設內容
```
