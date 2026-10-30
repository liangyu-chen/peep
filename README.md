# 窺視珈琲 3D

3D 的窺視珈琲小店（Next.js + three.js），加上可以編輯菜單、台詞和客人的後台，資料存在 Neon。

- `/`：咖啡廳本體，每次載入都讀最新的內容
- `/admin`：後台（菜單、老闆、熟客、新客隨機值、台詞），用 `ADMIN_PASSWORD` 登入；前台右上角有「後台登入」連結
- `/api/content`：目前的菜單、台詞、熟客和新客隨機值（JSON），`source` 會顯示資料來自 `db` 還是 `defaults`

沒設定資料庫時，網站照樣能跑，用的是 `src/content/catalog.ts` 裡的預設內容。

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入 DATABASE_URL、ADMIN_PASSWORD、SESSION_SECRET
npm run db:push              # 在 Neon 建立資料表
npm run db:seed              # 匯入預設內容（只填空的表）
npm run dev
```

`npm run db:seed` 只補缺的：空的表、還沒有任何台詞的情境、還沒有值的隨機欄位、還沒存過的老闆，所以加了新功能後再跑一次很安全（但你刻意清空的台詞情境也會被補回預設）。`npm run db:reset` 會清空所有資料再重新匯入預設值，後台改過的內容會全部消失。

## 部署到 Vercel

1. 把專案推上 GitHub，在 Vercel 匯入。
2. 在 Vercel → Settings → Environment Variables 設定：
   - `DATABASE_URL`：Neon 的連線字串（建議用 pooled 那條）
   - `ADMIN_PASSWORD`：後台密碼，跟本機的不要一樣
   - `SESSION_SECRET`：至少 16 個字元的隨機字串，例如 `openssl rand -hex 32` 的結果
3. 部署前在本機對正式資料庫跑一次 `npm run db:push` 和 `npm run db:seed`。之後如果資料表有新增（例如熟客、新客隨機值），再跑一次這兩個指令即可，既有資料不會被動到。

## 內容的規則

- 台詞只講資料庫裡有的：沒有台詞、或全部取消「啟用」的情境就不說話（預設台詞只在 `db:seed` 時寫進資料庫）
- 打戰鬥陀螺固定喊「3、2、1、Go Shoot!」，不用設定
- 菜單沒有任何上架品項 → 用預設菜單
- 價格留白 → 紙菜單上顯示 `$???`，模擬營收用隨機金額
- 熟客的「常點」被下架了 → 改點菜單上的其他飲料
- 熟客資料表一筆都沒有 → 用預設的 12 位熟客；全部取消「啟用」→ 只會來新客
- 熟客可以設定會不會打 NBA 2K（常用球隊）、快打旋風（常用角色）、戰鬥陀螺，以及會不會抽菸；球隊或角色沒指定就每次隨機
- 電視一次只跑一種遊戲，先坐下的人決定；有人在打電腦時，會打同一款的客人坐下就直接改成雙人對戰
- 戰鬥陀螺：店裡有兩位會玩的熟客坐著時，偶爾會從後面搬戰鬥盤到戶外區中間的籃子上開打
- 戶外區可以抽菸：會抽菸的客人偏好坐外面，桌上有菸灰缸
- 老闆的名字、長相和跟客人互動的台詞在「老闆」頁；客人台詞可用 `{owner}` 叫老闆
- 熟客的長相在「熟客 → 編輯 · 捏臉」調整（臉型、眼睛、瞳色、眉毛、鼻子、嘴巴、鬍子、眼鏡、腮紅、髮型與穿著），左邊有可旋轉的 3D 即時預覽；沒捏過的部位會依名字固定挑一個預設值
- 新客是隨機組出來的：名字 = 姓氏 + 稱呼（女性稱呼／男性稱呼決定打扮），再加一個身分；某一欄沒有啟用的值 → 用那一欄的預設值

台詞可用的變數（每個情境可用哪些，後台會標出來）：`{name}` 客人名字、`{drink}` 飲料、`{team}` 球隊、`{opponent}` 對手名字。

## 程式結構

```
app/                 Next.js 頁面：前台、後台、API、server actions
src/content/         菜單、台詞、熟客、新客隨機值的分類與預設值
src/db/schema.ts     Drizzle 資料表
src/lib/             資料庫連線、讀取內容、後台登入
src/cafe/            3D 場景（瀏覽器端）
  index.js           startCafe(root, content)：啟動並回傳關閉函式
  world/             建築、店內擺設、戶外區、後場、燈光
  body.js            人物模型（含臉部），前台和捏臉預覽共用
  people.js          人物動作、走路、對話泡泡
  preview.js         後台捏臉用的 3D 預覽
  sim.js             老闆和客人的行為、營業時間
  tv.js              電視上的 2K 比賽
  fight.js           電視上的快打旋風
  tops.js            戶外區的戰鬥陀螺
  hud.js             介面、視角、點選人物
scripts/seed.ts      匯入預設內容
```
