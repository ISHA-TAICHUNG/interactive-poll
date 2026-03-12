// ============================================================
//  Voting Page Logic
// ============================================================

let pollId = null;
let pollData = null;
let currentQuestion = null;
let selectedOptionId = null;
let questionUnsubscribe = null;
let votesUnsubscribe = null;

// ============================
//  Utilities
// ============================

function showState(name) {
  ['loading','error','waiting','voted-waiting','voting','results','login','correct','wrong'].forEach(s => {
    const el = document.getElementById(`state-${s}`);
    if (!el) return;
    if (s === name) {
      el.classList.remove('hidden');
      if (s === 'voting' || s === 'results') el.style.display = 'flex';
    } else {
      el.classList.add('hidden');
    }
  });
}

// ============================
//  Anonymous Voter Token
// ============================

function getVoterToken() {
  const key = 'ivp_voter_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(key, token);
  }
  return token;
}

function hasVoted(qId)        { return localStorage.getItem(`ivp_voted_${pollId}_${qId}`) === '1'; }
function markVoted(qId)       { localStorage.setItem(`ivp_voted_${pollId}_${qId}`, '1'); }
function getMyChoice(qId)     { return localStorage.getItem(`ivp_choice_${pollId}_${qId}`); }
function saveMyChoice(qId, o) { localStorage.setItem(`ivp_choice_${pollId}_${qId}`, o); }

// ============================
//  Init & Login
// ============================

let voterName = '';

function checkLogin() {
  const savedName = localStorage.getItem('ivp_voter_name');
  if (savedName) {
    voterName = savedName;
    return true;
  }
  return false;
}

document.getElementById('kahoot-join-btn').addEventListener('click', () => {
  const input = document.getElementById('kahoot-name-input').value.trim();
  if (!input) {
    showToast('請輸入暱稱才能加入遊戲！', 'error');
    return;
  }
  voterName = input;
  localStorage.setItem('ivp_voter_name', input);
  // 登入後才開始載入投票並建立即時監聽，確保 activeQuestion 變化能被偵測
  loadPoll();
});

function init() {
  pollId = new URLSearchParams(window.location.search).get('poll');
  if (!pollId) {
    showState('error');
    document.getElementById('error-message').textContent = '缺少投票活動 ID，請確認連結是否完整。';
    return;
  }
  
  if (!checkLogin()) {
    showState('login');
    // 自動 focus 輸入框，方便手機鍵盤彈出
    setTimeout(() => {
      const input = document.getElementById('kahoot-name-input');
      if (input) input.focus();
    }, 100);
  } else {
    loadPoll();
  }
}

async function loadPoll() {
  showState('loading');
  try {
    const doc = await db.collection('polls').doc(pollId).get();
    if (!doc.exists) { showState('error'); return; }
    pollData = doc.data();
    document.getElementById('vote-page-title').textContent = pollData.title || '互動投票';
    document.title = `${pollData.title || '投票'} · 互動投票系統`;
    listenToActiveQuestion();
  } catch (err) {
    showState('error');
    document.getElementById('error-message').textContent = '載入失敗：' + err.message;
  }
}

// ============================
//  Real-time listener
// ============================

function listenToActiveQuestion() {
  questionUnsubscribe = db.collection('polls').doc(pollId).onSnapshot(async doc => {
    if (!doc.exists) { showState('error'); return; }
    const activeQId = doc.data().activeQuestionId;

    if (!activeQId) {
      if (votesUnsubscribe) { votesUnsubscribe(); votesUnsubscribe = null; }
      // 若玩家剛投完票，重新取得題目最新狀態（isActive 已變 false）
      // 才能讓 handleStateChange 正確判斷並顯示正確/錯誤回饋
      if (currentQuestion) {
        const prevId = currentQuestion.id;
        try {
          const qDoc = await db.collection('polls').doc(pollId)
            .collection('questions').doc(prevId).get();
          if (qDoc.exists) {
            currentQuestion = { id: qDoc.id, ...qDoc.data() };
            handleStateChange();
            return;
          }
        } catch (_) { /* fall through */ }
      }
      currentQuestion = null;
      showState('waiting');
      return;
    }

    if (currentQuestion && currentQuestion.id === activeQId) return;

    try {
      const qDoc = await db.collection('polls').doc(pollId).collection('questions').doc(activeQId).get();
      if (!qDoc.exists) { showState('waiting'); return; }
      currentQuestion = { id: qDoc.id, ...qDoc.data() };
      selectedOptionId = null;
      if (votesUnsubscribe) { votesUnsubscribe(); votesUnsubscribe = null; }

      handleStateChange();
    } catch (err) {
      showState('error');
    }
  });
}

// ============================
//  State & Voting UI
// ============================

function handleStateChange() {
  if (!checkLogin()) {
    showState('login');
    return;
  }
  if (!currentQuestion) return;

  const qId = currentQuestion.id;
  const votedOptionId = getMyChoice(qId);
  const correctId = currentQuestion.correctOptionId;

  if (currentQuestion.isActive) {
    if (votedOptionId) showState('voted-waiting');
    else showVoting(currentQuestion);
  } else {
    if (votedOptionId && correctId) {
      if (votedOptionId === correctId) showState('correct');
      else showState('wrong');
      
      // 在背景載入結果，等使用者自己看投影，或者也可以設計過幾秒切換
      setTimeout(() => { if (currentQuestion && !currentQuestion.isActive && currentQuestion.id === qId) showResults(qId, currentQuestion); }, 3500);
    } else {
      showResults(qId, currentQuestion);
    }
  }
}

function showVoting(question) {
  showState('voting');
  document.getElementById('question-text-display').textContent = question.text;

  const optEl = document.getElementById('vote-options');
  optEl.innerHTML = '';
  selectedOptionId = null;

  question.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'vote-opt';
    btn.dataset.optionId = opt.id;
    btn.innerHTML = `
      <div class="vote-opt-circle">${opt.letter || LETTERS[i]}</div>
      <div class="vote-opt-text">${escapeHtml(opt.text)}</div>
      <div class="vote-opt-check">✓</div>`;
    btn.addEventListener('click', () => selectOpt(opt.id, btn));
    optEl.appendChild(btn);
  });

  document.getElementById('submit-vote-btn').disabled = true;
  document.getElementById('submit-vote-btn').onclick = submitVote;
}

function selectOpt(optionId, clickedBtn) {
  document.querySelectorAll('.vote-opt').forEach(el => el.classList.remove('selected'));
  clickedBtn.classList.add('selected');
  selectedOptionId = optionId;
  document.getElementById('submit-vote-btn').disabled = false;
}

// ============================
//  Submit
// ============================

async function submitVote() {
  if (!selectedOptionId || !currentQuestion) return;
  const btn = document.getElementById('submit-vote-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;width:18px;height:18px;margin:0 auto;"></div>';

  const qId = currentQuestion.id;
  const voterToken = getVoterToken();
  const finalName = voterName || localStorage.getItem('ivp_voter_name') || '匿名玩家';

  try {
    await db.collection('polls').doc(pollId)
      .collection('questions').doc(qId)
      .collection('votes').doc(voterToken)
      .set({ 
        optionId: selectedOptionId, 
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
        voterToken,
        name: finalName 
      });
    markVoted(qId);
    saveMyChoice(qId, selectedOptionId);
    handleStateChange();
    showToast('答案已送出！', 'success');
  } catch (err) {
    showToast('投票失敗：' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = '確認投票';
  }
}

// ============================
//  Results UI
// ============================

function showResults(qId, question) {
  showState('results');
  document.getElementById('results-question-text').textContent = question.text;
  const myChoice = getMyChoice(qId);
  const correctId = question.correctOptionId;

  if (votesUnsubscribe) votesUnsubscribe();
  votesUnsubscribe = db.collection('polls').doc(pollId)
    .collection('questions').doc(qId).collection('votes')
    .onSnapshot(snap => {
      const counts = {};
      snap.docs.forEach(d => { const o = d.data().optionId; counts[o] = (counts[o] || 0) + 1; });
      const total = snap.size;
      const maxVotes = Math.max(...Object.values(counts), 0);

      document.getElementById('results-total-votes').textContent = `共 ${total} 票`;

      document.getElementById('results-list').innerHTML = question.options.map((opt, i) => {
        const c = counts[opt.id] || 0;
        const pct = total > 0 ? Math.round((c / total) * 100) : 0;
        const isCorrect = correctId && opt.id === correctId;
        const isWinner = isCorrect || (!correctId && c === maxVotes && c > 0);
        const isMe = opt.id === myChoice;
        return `
          <div class="result-item ${isWinner ? 'winner' : ''}">
            <div class="result-row">
              <div class="result-opt-label">
                ${isCorrect ? '<span class="correct-tag">✓ 正確答案</span>' : ''}
                ${escapeHtml(opt.text)}
                ${isMe ? '<span class="my-vote-tag">我的選擇</span>' : ''}
              </div>
              <div class="result-stat">${c} · ${pct}%</div>
            </div>
            <div class="result-bar">
              <div class="result-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>`;
      }).join('');
    });
}

// ============================
//  Start
// ============================
document.addEventListener('DOMContentLoaded', init);
