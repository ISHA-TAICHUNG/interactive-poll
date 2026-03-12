// ============================================================
//  Display Page Logic (Projector / Large Screen)
// ============================================================

let pollId = null;
let currentQuestionId = null;
let votesUnsubscribe = null;
let qrGenerated = false;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

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
  renderBars(question.options, {}, 0);
  showSection('display-question-view');

  if (votesUnsubscribe) votesUnsubscribe();

  votesUnsubscribe = db.collection('polls').doc(pollId)
    .collection('questions').doc(question.id).collection('votes')
    .onSnapshot(snap => {
      const counts = {};
      snap.docs.forEach(d => { const o = d.data().optionId; counts[o] = (counts[o] || 0) + 1; });
      document.getElementById('display-total-count').textContent = snap.size;
      renderBars(question.options, counts, snap.size);
    });
}

function renderBars(options, counts, total) {
  const maxVotes = Math.max(...Object.values(counts), 0);
  document.getElementById('display-results').innerHTML = options.map((opt, i) => {
    const c = counts[opt.id] || 0;
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    const isWinner = c === maxVotes && c > 0;
    return `
      <div class="display-res-item">
        <div class="display-res-label">${opt.letter || LETTERS[i]}. ${escapeHtml(opt.text)}</div>
        <div class="display-res-bar-wrap">
          <div class="display-res-bar">
            <div class="display-res-bar-fill ${isWinner ? 'winner' : ''}" style="width:${pct}%">
              ${pct > 8 ? pct + '%' : ''}
            </div>
          </div>
        </div>
        <div class="display-res-count">${c}</div>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', init);
