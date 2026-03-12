// ============================================================
//  Admin Panel Logic
// ============================================================

let currentUser = null;
let currentPollId = null;
let questionsUnsubscribe = null;
let votesUnsubscribers = {};
let qrCodeInstance = null;

// ============================
//  Utilities
// ============================

function showModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id)  { document.getElementById(id).classList.add('hidden'); }

function showSection(id) {
  document.getElementById('welcome-panel').classList.add('hidden');
  document.getElementById('poll-view').classList.add('hidden');
  const el = document.getElementById(id);
  el.classList.remove('hidden');
  if (id === 'poll-view') el.style.display = 'flex';
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ============================
//  Auth
// ============================

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
    document.getElementById('user-email').textContent = user.email;
    loadPolls();
  } else {
    currentUser = null;
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('admin-app').classList.add('hidden');
  }
});

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('login-btn');
  const errDiv   = document.getElementById('login-error');

  btn.disabled = true; btn.textContent = '登入中...';
  errDiv.classList.add('hidden');

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    const msgs = {
      'auth/user-not-found':    '找不到此帳號',
      'auth/wrong-password':    '密碼錯誤',
      'auth/invalid-email':     '電子郵件格式錯誤',
      'auth/invalid-credential':'帳號或密碼錯誤',
      'auth/too-many-requests': '嘗試次數過多，請稍後再試'
    };
    errDiv.textContent = msgs[err.code] || err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = '登入';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  auth.signOut();
  currentPollId = null;
  if (questionsUnsubscribe) { questionsUnsubscribe(); questionsUnsubscribe = null; }
});

// ============================
//  Polls
// ============================

async function loadPolls() {
  const listEl = document.getElementById('polls-list');
  listEl.innerHTML = '<div class="flex items-center gap-3" style="padding:16px;"><div class="spinner"></div><span style="font-size:13px;color:var(--tx-3);">載入中...</span></div>';

  try {
    db.collection('polls')
      .where('adminId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => renderPollsList(snap.docs));
  } catch (err) {
    listEl.innerHTML = `<p style="padding:16px;color:var(--red-500);font-size:13px;">載入失敗: ${err.message}</p>`;
  }
}

function renderPollsList(docs) {
  const listEl = document.getElementById('polls-list');
  if (docs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="e-icon">🗳️</div>
        <div class="e-title">尚無投票活動</div>
        <div class="e-desc">點擊上方「新增活動」開始</div>
      </div>`;
    return;
  }
  listEl.innerHTML = '';
  docs.forEach(doc => {
    const poll = doc.data();
    const item = document.createElement('div');
    item.className = 'poll-item' + (doc.id === currentPollId ? ' active' : '');
    item.dataset.pollId = doc.id;
    item.innerHTML = `
      <div class="poll-dot"></div>
      <div class="poll-item-text">
        <div class="poll-item-name">${escapeHtml(poll.title)}</div>
        <div class="poll-item-date">${formatDate(poll.createdAt)}</div>
      </div>`;
    item.addEventListener('click', () => selectPoll(doc.id, poll));
    listEl.appendChild(item);
  });
}

// Create poll
document.getElementById('create-poll-btn').addEventListener('click', () => showModal('modal-create-poll'));
document.getElementById('welcome-create-btn').addEventListener('click', () => showModal('modal-create-poll'));
document.getElementById('cancel-create-poll').addEventListener('click', () => hideModal('modal-create-poll'));

document.getElementById('confirm-create-poll').addEventListener('click', async () => {
  const title = document.getElementById('new-poll-title').value.trim();
  if (!title) { showToast('請輸入活動名稱', 'error'); return; }
  const btn = document.getElementById('confirm-create-poll');
  btn.disabled = true; btn.textContent = '建立中...';
  try {
    const ref = await db.collection('polls').add({
      title, description: document.getElementById('new-poll-desc').value.trim(),
      adminId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      activeQuestionId: null
    });
    hideModal('modal-create-poll');
    document.getElementById('new-poll-title').value = '';
    document.getElementById('new-poll-desc').value = '';
    showToast('活動建立成功！', 'success');
    selectPoll(ref.id, { title });
  } catch (err) {
    showToast('建立失敗: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '建立活動';
  }
});

// Reset poll votes
document.getElementById('reset-poll-btn').addEventListener('click', async () => {
  if (!currentPollId) return;
  if (!confirm('確定要重置所有票數？題目會保留，但所有投票紀錄將清除，此操作無法復原。')) return;

  const btn = document.getElementById('reset-poll-btn');
  btn.disabled = true; btn.textContent = '重置中...';

  try {
    const qSnap = await db.collection('polls').doc(currentPollId).collection('questions').get();

    // 每 400 筆送一次 batch，避免超過 Firestore 500 筆上限
    let batch = db.batch();
    let count = 0;

    for (const qDoc of qSnap.docs) {
      const vSnap = await db.collection('polls').doc(currentPollId)
        .collection('questions').doc(qDoc.id).collection('votes').get();

      vSnap.docs.forEach(vDoc => {
        batch.delete(vDoc.ref);
        count++;
        if (count >= 400) {
          batch.commit();
          batch = db.batch();
          count = 0;
        }
      });

      // 重設題目狀態
      batch.update(qDoc.ref, { isActive: false });
      count++;
    }

    // 清除目前開放的題目
    batch.update(db.collection('polls').doc(currentPollId), { activeQuestionId: null });
    await batch.commit();

    showToast('票數已重置，題目保留完整！', 'success');
  } catch (err) {
    showToast('重置失敗: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '🔄 重置票數';
  }
});

// Delete poll
document.getElementById('delete-poll-btn').addEventListener('click', async () => {
  if (!currentPollId) return;
  if (!confirm('確定要刪除此投票活動？所有題目與投票資料也將一併刪除，此操作無法復原。')) return;
  try {
    const qSnap = await db.collection('polls').doc(currentPollId).collection('questions').get();
    const batch = db.batch();
    qSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('polls').doc(currentPollId));
    await batch.commit();
    showToast('活動已刪除', 'success');
    currentPollId = null;
    showSection('welcome-panel');
    if (questionsUnsubscribe) { questionsUnsubscribe(); questionsUnsubscribe = null; }
  } catch (err) {
    showToast('刪除失敗: ' + err.message, 'error');
  }
});

// ============================
//  Select Poll
// ============================

function selectPoll(pollId, pollData) {
  document.querySelectorAll('.poll-item').forEach(el => el.classList.toggle('active', el.dataset.pollId === pollId));
  currentPollId = pollId;
  showSection('poll-view');
  document.getElementById('poll-title-display').textContent = pollData.title || '';
  generateQRCode(pollId);

  if (questionsUnsubscribe) { questionsUnsubscribe(); }
  Object.values(votesUnsubscribers).forEach(u => u());
  votesUnsubscribers = {};

  questionsUnsubscribe = db.collection('polls').doc(pollId)
    .collection('questions').orderBy('order', 'asc')
    .onSnapshot(snap => renderQuestions(pollId, snap.docs));
}

// ============================
//  QR Code
// ============================

function generateQRCode(pollId) {
  const voteUrl = `${APP_CONFIG.baseUrl}vote.html?poll=${pollId}`;
  document.getElementById('qr-url-text').textContent = voteUrl;

  const container = document.getElementById('qrcode-container');
  container.innerHTML = '';
  new QRCode(container, {
    text: voteUrl, width: 160, height: 160,
    colorDark: '#0F172A', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  document.getElementById('copy-url-btn').onclick = () => {
    navigator.clipboard.writeText(voteUrl).then(() => showToast('連結已複製', 'success'));
  };

  document.getElementById('download-qr-btn').onclick = () => {
    setTimeout(() => {
      const canvas = container.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `qrcode-${pollId}.png`; link.href = canvas.toDataURL(); link.click();
      }
    }, 200);
  };

  document.getElementById('open-display-btn').onclick = () => {
    window.open(`display.html?poll=${pollId}`, '_blank');
  };
}

// ============================
//  Add Question
// ============================

document.getElementById('add-question-btn').addEventListener('click', () => {
  resetQuestionForm(); showModal('modal-add-question');
});
document.getElementById('cancel-add-question').addEventListener('click', () => hideModal('modal-add-question'));

function resetQuestionForm() {
  document.getElementById('new-question-text').value = '';
  const list = document.getElementById('options-input-list');
  list.innerHTML = '';
  addOptionRow(0); addOptionRow(1);
  updateRemoveBtns();
}

function addOptionRow(idx) {
  const list = document.getElementById('options-input-list');
  const i = (idx !== undefined) ? idx : list.children.length;
  const letter = LETTERS[i] || String(i + 1);
  const row = document.createElement('div');
  row.className = 'opt-input-row';
  row.style.alignItems = 'center';
  
  // 加上單選框 (name="correct-option")
  row.innerHTML = `
    <input type="radio" name="correct-option" value="${i}" title="設為正確答案" style="width:18px; height:18px; margin-right:4px; cursor:pointer;" ${i === 0 ? 'checked' : ''}>
    <div class="opt-input-badge">${letter}</div>
    <input type="text" class="form-input option-input" placeholder="選項 ${letter}" style="flex:1;">
    <button type="button" class="opt-remove-btn" onclick="removeOptRow(this)">✕</button>`;
  list.appendChild(row);
  updateRemoveBtns();
}

window.removeOptRow = function(btn) {
  const list = document.getElementById('options-input-list');
  if (list.children.length <= 2) { showToast('至少需要兩個選項', 'error'); return; }
  btn.closest('.opt-input-row').remove();
  Array.from(list.children).forEach((row, i) => {
    const letter = LETTERS[i] || String(i + 1);
    row.querySelector('.opt-input-badge').textContent = letter;
    row.querySelector('input[type="text"]').placeholder = `選項 ${letter}`;
    row.querySelector('input[type="radio"]').value = i;
  });
  updateRemoveBtns();
};

function updateRemoveBtns() {
  const rows = document.querySelectorAll('#options-input-list .opt-input-row');
  rows.forEach(r => { const b = r.querySelector('.opt-remove-btn'); if (b) b.style.visibility = rows.length <= 2 ? 'hidden' : 'visible'; });
}

document.getElementById('add-option-btn').addEventListener('click', () => {
  const list = document.getElementById('options-input-list');
  if (list.children.length >= 8) { showToast('最多支援 8 個選項', 'error'); return; }
  addOptionRow();
});

document.getElementById('confirm-add-question').addEventListener('click', async () => {
  if (!currentPollId) return;
  const text = document.getElementById('new-question-text').value.trim();
  if (!text) { showToast('請輸入題目內容', 'error'); return; }

  const options = [];
  document.querySelectorAll('#options-input-list .option-input').forEach((input, i) => {
    const val = input.value.trim();
    if (val) options.push({ id: `opt_${i}`, text: val, letter: LETTERS[i] || String(i + 1) });
  });
  if (options.length < 2) { showToast('請至少填寫兩個選項', 'error'); return; }

  const btn = document.getElementById('confirm-add-question');
  btn.disabled = true; btn.textContent = '新增中...';
  try {
    const snap = await db.collection('polls').doc(currentPollId).collection('questions').get();
    
    // 找出正確解答 ID
    const correctRadio = document.querySelector('input[name="correct-option"]:checked');
    let correctOptionId = null;
    if (correctRadio) {
      const selectedIndex = parseInt(correctRadio.value, 10);
      if (options[selectedIndex]) {
        correctOptionId = options[selectedIndex].id;
      }
    }

    await db.collection('polls').doc(currentPollId).collection('questions').add({
      text, options, order: snap.size, isActive: false, correctOptionId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    hideModal('modal-add-question');
    showToast('題目已新增！', 'success');
  } catch (err) {
    showToast('新增失敗: ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '新增題目';
  }
});

// ============================
//  Render Questions
// ============================

function renderQuestions(pollId, docs) {
  const container = document.getElementById('questions-container');
  if (docs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="e-icon">📝</div>
        <div class="e-title">尚無題目</div>
        <div class="e-desc">點擊「新增題目」建立第一個投票問題</div>
      </div>`;
    return;
  }

  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'questions-wrap';

  docs.forEach((doc, idx) => {
    const q = doc.data();
    const qId = doc.id;
    const card = document.createElement('div');
    card.className = 'q-card' + (q.isActive ? ' is-active' : '');
    card.id = `q-card-${qId}`;
    card.innerHTML = `
      <div class="q-card-hd">
        <span class="q-num">題目 ${idx + 1}</span>
        ${q.isActive
          ? `<span class="badge badge-live"><span style="width:6px;height:6px;border-radius:50%;background:#10B981;flex-shrink:0;"></span>投票中</span>`
          : `<span class="badge badge-idle">未開放</span>`}
        <div class="q-card-actions">
          ${q.isActive
            ? `<button class="btn btn-sm" style="background:#FFF7ED;color:#D97706;border-color:#FED7AA;" onclick="deactivateQuestion('${pollId}','${qId}')">⏹ 關閉</button>`
            : `<button class="btn btn-success btn-sm" onclick="activateQuestion('${pollId}','${qId}')">▶ 開放投票</button>`}
          <button class="btn btn-danger btn-xs" onclick="deleteQuestion('${pollId}','${qId}')">🗑</button>
        </div>
      </div>
      <div class="q-card-body">
        <div class="q-text">${escapeHtml(q.text)}</div>
        <div class="q-tag" style="font-size:12px; margin-bottom:12px; color:var(--tx-3);">
          解答：${q.correctOptionId ? escapeHtml(q.options.find(o => o.id === q.correctOptionId)?.text || '無') : '無標準答案'}
        </div>
        <div class="opt-list" id="opts-${qId}">${renderOpts(q.options, {}, 0, {}, q.correctOptionId)}</div>
      </div>`;
    wrap.appendChild(card);
    listenToVotes(pollId, qId, q);
  });

  container.appendChild(wrap);
}

function renderOpts(options, counts, total, votersByOpt = {}, correctOptionId = null) {
  return options.map((opt, i) => {
    const c = counts[opt.id] || 0;
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    
    const isCorrect = correctOptionId === opt.id;
    
    const voters = votersByOpt[opt.id] || [];
    const votersHtml = voters.length > 0 
      ? `<div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:4px;">` + 
        voters.map(n => `<span style="background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:12px; font-size:12px;">${escapeHtml(n)}</span>`).join('') + 
        `</div>`
      : '';

    return `
      <div class="opt-row" style="flex-direction:column; align-items:flex-start;">
        <div style="display:flex; width:100%; align-items:center;">
          ${isCorrect ? `<span style="color:#10B981; margin-right:6px; font-weight:800;" title="正確答案">✓</span>` : ''}
          <div class="opt-letter">${opt.letter || LETTERS[i]}</div>
          <div class="opt-label">${escapeHtml(opt.text)}</div>
          <div class="opt-bar-wrap">
            <div class="opt-bar"><div class="opt-bar-fill" style="width:${pct}%; ${isCorrect ? 'background:#10B981;' : ''}"></div></div>
          </div>
          <div class="opt-votes">${c} 票 · ${pct}%</div>
        </div>
        ${votersHtml}
      </div>`;
  }).join('');
}

function listenToVotes(pollId, qId, qDocData) {
  if (votesUnsubscribers[qId]) votesUnsubscribers[qId]();
  votesUnsubscribers[qId] = db.collection('polls').doc(pollId)
    .collection('questions').doc(qId).collection('votes')
    .onSnapshot(snap => {
      const counts = {};
      const votersByOpt = {};
      
      snap.docs.forEach(d => { 
        const data = d.data();
        const o = data.optionId; 
        counts[o] = (counts[o] || 0) + 1; 
        
        if (!votersByOpt[o]) votersByOpt[o] = [];
        if (data.name) votersByOpt[o].push(data.name);
      });
      
      const el = document.getElementById(`opts-${qId}`);
      if (el) el.innerHTML = renderOpts(qDocData.options, counts, snap.size, votersByOpt, qDocData.correctOptionId);
    });
}

// ============================
//  Activate / Deactivate
// ============================

window.activateQuestion = async function(pollId, qId) {
  try {
    const snap = await db.collection('polls').doc(pollId).collection('questions').get();
    const batch = db.batch();
    snap.docs.forEach(d => { if (d.id !== qId) batch.update(d.ref, { isActive: false }); });
    batch.update(db.collection('polls').doc(pollId).collection('questions').doc(qId), { isActive: true });
    batch.update(db.collection('polls').doc(pollId), { activeQuestionId: qId });
    await batch.commit();
    showToast('題目已開放投票', 'success');
  } catch (err) {
    showToast('操作失敗: ' + err.message, 'error');
  }
};

window.deactivateQuestion = async function(pollId, qId) {
  try {
    await db.collection('polls').doc(pollId).collection('questions').doc(qId).update({ isActive: false });
    await db.collection('polls').doc(pollId).update({ activeQuestionId: null });
    showToast('投票已關閉', 'success');
  } catch (err) {
    showToast('操作失敗: ' + err.message, 'error');
  }
};

window.deleteQuestion = async function(pollId, qId) {
  if (!confirm('確定要刪除此題目？相關投票資料也將一併刪除。')) return;
  try {
    const vSnap = await db.collection('polls').doc(pollId).collection('questions').doc(qId).collection('votes').get();
    const batch = db.batch();
    vSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('polls').doc(pollId).collection('questions').doc(qId));
    await batch.commit();
    if (votesUnsubscribers[qId]) { votesUnsubscribers[qId](); delete votesUnsubscribers[qId]; }
    showToast('題目已刪除', 'success');
  } catch (err) {
    showToast('刪除失敗: ' + err.message, 'error');
  }
};
