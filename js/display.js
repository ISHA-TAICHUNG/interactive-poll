// ============================================================
//  Display Page Logic (Projector / Large Screen)
// ============================================================

let pollId = null;
let currentQuestionId = null;
let votesUnsubscribe = null;
let qrGenerated = false;

function showSection(id) {
  ['display-loading','display-waiting','display-question-view'].forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    if (s === id) {
      el.classList.remove('hidden');
      if (s === 'display-question-view') el.style.display = 'flex';
    } else {
      el.classList.add('hidden');
    }
  });
}

// ============================
//  Init
// ============================

function init() {
  pollId = new URLSearchParams(window.location.search).get('poll');
  if (!pollId) { showSection('display-waiting'); return; }

  // Generate QR code
  if (!qrGenerated) {
    new QRCode(document.getElementById('display-qrcode'), {
      text: `${APP_CONFIG.baseUrl}vote.html?poll=${pollId}`,
      width: 148, height: 148,
      colorDark: '#0F172A', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    qrGenerated = true;
  }

  loadPoll();
}

async function loadPoll() {
  try {
    const doc = await db.collection('polls').doc(pollId).get();
    if (!doc.exists) { showSection('display-waiting'); return; }
    document.getElementById('display-poll-name').textContent = doc.data().title || '投票活動';
    document.title = `${doc.data().title || '投票'} · 即時顯示`;
    listenToActive();
  } catch (err) {
    console.error(err);
    showSection('display-waiting');
  }
}

function listenToActive() {
  db.collection('polls').doc(pollId).onSnapshot(async doc => {
    if (!doc.exists) { showSection('display-waiting'); return; }
    const activeQId = doc.data().activeQuestionId;

    if (!activeQId) {
      if (votesUnsubscribe) { votesUnsubscribe(); votesUnsubscribe = null; }
      currentQuestionId = null;
      showSection('display-waiting');
      return;
    }

    if (currentQuestionId === activeQId) return;
    currentQuestionId = activeQId;

    try {
      const qDoc = await db.collection('polls').doc(pollId).collection('questions').doc(activeQId).get();
      if (!qDoc.exists) { showSection('display-waiting'); return; }
      displayQuestion({ id: qDoc.id, ...qDoc.data() });
    } catch (err) {
      showSection('display-waiting');
    }
  });
}

function displayQuestion(question) {
  document.getElementById('display-q-text').textContent = question.text;
  renderBars(question, {}, 0);
  showSection('display-question-view');

  if (votesUnsubscribe) votesUnsubscribe();

  votesUnsubscribe = db.collection('polls').doc(pollId)
      .collection('questions').doc(question.id).collection('votes')
      .onSnapshot(snap => {
        const counts = {};
        const votersByOpt = {}; // 新增：用來存放每個選項的投票者暱稱
        
        snap.docs.forEach(d => { 
          const data = d.data();
          const o = data.optionId; 
          counts[o] = (counts[o] || 0) + 1; 
          
          if (!votersByOpt[o]) votersByOpt[o] = [];
          if (data.name) votersByOpt[o].push(data.name);
        });
        
        document.getElementById('display-total-count').textContent = snap.size;
        renderBars(question, counts, snap.size, votersByOpt);
      });
}

function renderBars(question, counts, total, votersByOpt = {}) {
  const options = question.options;
  const correctId = question.correctOptionId;
  const maxVotes = Math.max(...Object.values(counts), 0);
  
  document.getElementById('display-results').innerHTML = options.map((opt, i) => {
    const c = counts[opt.id] || 0;
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    
    // 依據是否設定標準答案來決定 isWinner 發光特效
    const isWinner = correctId ? opt.id === correctId : c === maxVotes && c > 0;
    
    // 生成該選項的暱稱標籤 HTML
    const voters = votersByOpt[opt.id] || [];
    const votersHtml = voters.length > 0 
      ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; font-size:14px; color:var(--tx-2);">`
        + voters.map(name => `<span style="background:rgba(255,255,255,0.2); padding:4px 10px; border-radius:12px;">${escapeHtml(name)}</span>`).join('')
        + `</div>`
      : '';

    return `
      <div class="display-res-item" style="padding-bottom: 24px; transition: opacity 0.5s;">
        <div class="display-res-label">
          ${opt.letter || LETTERS[i]}. ${escapeHtml(opt.text)}
          ${isWinner && correctId && !question.isActive ? '<span style="font-size:12px;font-weight:700;background:rgba(110,231,183,.15);color:#6EE7B7;border:1px solid rgba(110,231,183,.3);padding:2px 8px;border-radius:20px;margin-left:8px;">✓ 正確答案</span>' : ''}
        </div>
        <div class="display-res-bar-wrap">
          <div class="display-res-bar" style="${!isWinner && !question.isActive && correctId ? 'opacity:0.3;' : ''}">
            <div class="display-res-bar-fill ${isWinner ? 'winner' : ''}" style="width:${pct}%">
              ${pct > 8 ? pct + '%' : ''}
            </div>
          </div>
        </div>
        <div class="display-res-count">${c}</div>
        ${votersHtml}
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', init);
