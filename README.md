# 早押しクイズバトル（4人・レートマッチング）

React + Tailwind / Node.js + Socket.io / Firebase (Auth + Firestore)

```
quiz-app/
├─ client/   React(Vite) … Vercel にデプロイ
├─ server/   Node.js + Socket.io … Render 等にデプロイ
└─ firestore.rules
```

## 1. Firebase 設定
1. プロジェクト作成 → Authentication で **Google** を有効化
2. Firestore を作成し、`firestore.rules` の内容を貼り付けて公開
3. プロジェクト設定 → ウェブアプリを追加し、設定値を `client/.env` に記入（`client/.env.example` 参照）
4. プロジェクト設定 → サービスアカウント → 新しい秘密鍵を生成。JSON を**1行にして**サーバーの環境変数 `FIREBASE_SERVICE_ACCOUNT` に設定

## 2. ローカル実行
```bash
cd server && npm install && cp .env.example .env && npm run dev   # :3001
cd client && npm install && cp .env.example .env && npm run dev   # :5173
```
`FIREBASE_SERVICE_ACCOUNT` が空のサーバーは **開発モード**（メモリ保存・トークン `dev:名前` を許可）で動きます。
4人対戦の動作確認: `cd server && npm run simulate`（別ターミナルでサーバー起動中に実行）。
テスト用に `MATCH_SIZE=2` や `QUESTION_TIME_MS=5000` で短縮できます。

## 3. デプロイ
- **Render**: Root Directory=`server`、Build=`npm install`、Start=`npm start`。環境変数 `FIREBASE_SERVICE_ACCOUNT`、`CLIENT_ORIGIN`(VercelのURL)、`NODE_ENV=production`
- **Vercel**: Root Directory=`client`。環境変数 `VITE_FB_*` と `VITE_SERVER_URL`(RenderのURL)
- Firebase Auth の「承認済みドメイン」にVercelのドメインを追加
- Render無料枠はスリープします。`/health` を外部監視(UptimeRobot等)で定期的に叩くと起きやすくなります

## 4. 問題JSON
`server/questions.json` を差し替えます（`QUESTIONS_PATH` で場所変更可）。`answer` は0始まりの選択肢番号。
```json
[{ "question": "日本の首都は？", "choices": ["大阪","京都","東京","名古屋"], "answer": 2, "explanation": "任意" }]
```
1試合ごとに重複なしでランダム10問（問題数が10未満なら全問）。1問の制限時間は60秒。

## 5. ルール実装メモ
- **ランク**: ルーキー〜ダイヤは Pt の範囲で決定（各サブランク5→1）。7000pt でマスター(MR1500)に昇格し、以降は MR が増減。MR上位100人が表示上「エンペラー」（1分ごとに更新）
- **降格**: ルーキー〜ゴールドは降格なし（現在のサブランクの下限で止まる）。プラチナ・ダイヤはサブランクが降格し、ティアの下限（3500 / 5000）は割らない。マスターには降格しない。エンペラーはMR順位から外れるとマスターに戻る
  - ※ ダイヤ5→プラチナ1のようなティア降格を許す場合は `server/src/rating.js` の `applyDelta` を変更
- **マッチング**: レート差 300 から開始し、待つほど許容差が 30/秒で広がる。マスターは `7000 + (MR-1500)` として比較
- **早押し**: 選択肢タップ＝解答。最初の正解で他の人の画面をロックし、150ms の受付窓の中でラグ補正後タイムが最速の人を勝者にする（補正はRTTの半分、上限250ms。クライアント申告タイムは信用しない）。誤答（お手つき）はその問題の解答権を失い、他の3人は続行
- **得点と時間**: 各問の勝者に1点。解答時間は、正解した人=自分のタイム／お手つき=60秒／未回答=決着時刻（誰も正解しなければ60秒）
- **レート計算**: `server/src/rating.js` の `calculateRateChange`（ご提示の関数そのまま）。順位は得点→平均時間
- 切断した人はその試合の残りを未回答扱い。全員切断した試合はレート変動なし（再接続は未実装）
