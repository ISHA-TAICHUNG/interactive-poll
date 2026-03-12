# 互動投票系統 (Interactive Poll System)

一個類似 Mentimeter 的即時互動投票系統，支援 QR Code 無記名投票，並附有管理者後台。

## 功能特色

- **QR Code 無記名投票** — 掃碼即可參與，無需登入或下載 App
- **即時同步** — 投票結果即時更新，所有人同時看到最新數據
- **管理者後台** — 建立投票活動、新增題目與選項、控制投票開放時間
- **防重複投票** — 透過 LocalStorage Token 確保每人每題只能投一次
- **投影顯示模式** — 大螢幕即時顯示結果，適合課堂或會議
- **視覺化統計** — 即時長條圖顯示各選項票數與百分比

## 頁面說明

| 頁面 | 網址 | 說明 |
|------|------|------|
| 首頁 | `index.html` | 功能介紹與入口 |
| 管理後台 | `admin.html` | 管理者登入、建立投票、管理題目 |
| 投票頁 | `vote.html?poll=POLL_ID` | 參與者掃碼後進入的投票介面 |
| 投影模式 | `display.html?poll=POLL_ID` | 大螢幕即時顯示結果 |

---

## 部署步驟

### 步驟一：建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「建立專案」，輸入專案名稱
3. 依指示完成建立（可關閉 Google Analytics）

### 步驟二：啟用 Firestore 資料庫

1. 在 Firebase Console 左側選單點擊「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「以測試模式開始」（之後會套用正式 rules）
4. 選擇資料庫位置（建議選 `asia-east1` 台灣）

### 步驟三：啟用 Authentication

1. 在 Firebase Console 左側選單點擊「Authentication」
2. 點擊「開始使用」
3. 在「Sign-in method」選擇「電子郵件/密碼」並啟用
4. 前往「Users」頁籤，點擊「新增使用者」
5. 輸入管理者的電子郵件和密碼

### 步驟四：取得 Firebase 設定

1. 在 Firebase Console 點擊齒輪圖示 → 「專案設定」
2. 在「一般」頁籤，向下滾動到「您的應用程式」
3. 點擊「</> 網路應用程式」圖示
4. 輸入應用程式名稱，點擊「註冊應用程式」
5. 複製 `firebaseConfig` 物件中的所有設定值

### 步驟五：更新設定檔

開啟 `js/config.js`，將以下佔位符替換為您的實際設定：

```javascript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",              // ← 替換這裡
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // ← 替換
  projectId: "YOUR_PROJECT_ID",        // ← 替換
  storageBucket: "YOUR_PROJECT_ID.appspot.com",   // ← 替換
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",  // ← 替換
  appId: "YOUR_APP_ID"                 // ← 替換
};
```

### 步驟六：套用 Firestore 安全規則

1. 在 Firebase Console 前往「Firestore Database」→「規則」
2. 將 `firestore.rules` 檔案的內容複製貼上
3. 點擊「發布」

### 步驟七：部署到 GitHub Pages

1. 在 GitHub 建立新的 Repository（公開）

2. 將專案推送到 GitHub：
   ```bash
   cd interactive-poll
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

3. 在 GitHub Repository 頁面：
   - 點擊「Settings」
   - 左側選單點擊「Pages」
   - Source 選擇「Deploy from a branch」
   - Branch 選擇 `main`，資料夾選 `/ (root)`
   - 點擊「Save」

4. 等待 1-3 分鐘，GitHub Pages 會顯示您的網站網址：
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
   ```

### 步驟八：設定 Firebase 授權網域

1. 在 Firebase Console 前往「Authentication」→「Settings」
2. 在「授權的網域」中新增您的 GitHub Pages 網域：
   ```
   YOUR_USERNAME.github.io
   ```

---

## 使用說明

### 管理者操作

1. 前往 `admin.html` 並登入
2. 點擊「新增活動」建立投票活動
3. 選擇活動後，可看到自動產生的 **QR Code**
4. 點擊「新增題目」新增投票題目和選項
5. 點擊題目的「▶ 開放投票」按鈕開始收票
6. 即時看到每個選項的票數和百分比
7. 點擊「⏹ 關閉投票」結束此題
8. 點擊「🖥️ 投影模式」開啟大螢幕顯示頁面

### 參與者操作

1. 掃描 QR Code 或點擊連結進入投票頁
2. 等待管理者開放題目
3. 選擇選項後點擊「確認投票」
4. 即時看到所有人的投票結果

---

## 專案結構

```
interactive-poll/
├── index.html          # 首頁 / 功能介紹
├── admin.html          # 管理者後台
├── vote.html           # 參與者投票頁
├── display.html        # 投影顯示模式
├── css/
│   └── style.css       # 所有頁面的樣式
├── js/
│   ├── config.js       # Firebase 設定 (需修改)
│   ├── admin.js        # 管理者後台邏輯
│   ├── vote.js         # 投票頁邏輯
│   └── display.js      # 投影顯示邏輯
├── firestore.rules     # Firestore 安全規則
└── README.md           # 本文件
```

---

## 技術架構

| 元件 | 技術 |
|------|------|
| 前端 | HTML5 / CSS3 / Vanilla JavaScript |
| 即時資料庫 | Firebase Firestore |
| 身份驗證 | Firebase Authentication |
| QR Code 產生 | QRCode.js |
| 靜態託管 | GitHub Pages |

---

## 常見問題

**Q: 參與者需要登入嗎？**
A: 不需要。參與者透過 QR Code 進入後即可匿名投票，無需任何帳號。

**Q: 如何防止重複投票？**
A: 系統會在瀏覽器的 LocalStorage 中儲存投票記錄，同一瀏覽器同一題目只能投一次。

**Q: 可以同時開多個投票活動嗎？**
A: 可以。系統支援多個獨立的投票活動，每個活動有自己的 QR Code。

**Q: 免費嗎？**
A: Firebase Spark（免費）方案支援每天 50,000 次讀取和 20,000 次寫入，一般活動使用綽綽有餘。
