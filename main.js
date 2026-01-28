// 고스트라이더 - 배달 전략 도우미
// 알고리즘을 역이용하자

// ==================== Firebase 설정 ====================
let db = null;
let chatUnsubscribe = null;

function initFirebase() {
  try {
    // firebase-config.js에서 설정 확인
    if (typeof FIREBASE_CONFIG === 'undefined' || !isFirebaseConfigured) {
      console.log('Firebase 설정이 필요합니다. firebase-config.js를 확인하세요.');
      return false;
    }

    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      console.log('Firebase 초기화 완료');
      return true;
    }
  } catch (e) {
    console.log('Firebase 초기화 실패:', e);
  }
  return false;
}

// ==================== 데이터 저장소 ====================
const Storage = {
  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(`ghostrider_${key}`);
      return data ? JSON.parse(data) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set(key, value) {
    localStorage.setItem(`ghostrider_${key}`, JSON.stringify(value));
  }
};

// ==================== 앱 상태 ====================
const state = {
  calls: Storage.get('calls', []),
  memos: Storage.get('memos', []),
  expenses: Storage.get('expenses', []),
  settings: Storage.get('settings', {
    minPrice: 3000,
    minPricePerKm: 2500
  }),
  currentExpenseType: 'food',
  timers: Storage.get('timers', {
    baemin: { running: false, seconds: 0, startTime: null },
    coupang: { running: false, seconds: 0, startTime: null },
    yogiyo: { running: false, seconds: 0, startTime: null }
  }),
  currentMemoType: 'store',
  currentPeriod: 'today',
  currentRegion: Storage.get('currentRegion', 'seoul'),
  nickname: Storage.get('nickname', generateNickname()),
  oderId: Storage.get('oderId', generateUserId())
};

// ==================== 유저 ID/닉네임 생성 ====================
function generateNickname() {
  const adjectives = ['빠른', '날쌘', '용감한', '친절한', '열정적인', '멋진', '쿨한', '핫한'];
  const nouns = ['라이더', '배달원', '기사', '달리미', '번개', '로켓', '질주'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ==================== 유틸리티 함수 ====================
function formatPrice(price) {
  return new Intl.NumberFormat('ko-KR').format(price) + '원';
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

// ==================== 탭 관리 ====================
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // 버튼 활성화
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 패널 활성화
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${tabId}`).classList.add('active');

      // 분석 탭이면 통계 업데이트
      if (tabId === 'stats') {
        updateStats();
      }

      // 커뮤니티 탭이면 채팅 초기화
      if (tabId === 'community') {
        initChat();
      }
    });
  });
}

// ==================== 최소 단가 설정 ====================
function initMinPriceSlider() {
  const slider = document.getElementById('min-price-slider');
  const display = document.getElementById('min-price-display');
  const sliderPerKm = document.getElementById('min-price-per-km-slider');
  const displayPerKm = document.getElementById('min-price-per-km-display');

  // 최소 단가
  slider.value = state.settings.minPrice;
  display.textContent = formatPrice(state.settings.minPrice);

  slider.addEventListener('input', () => {
    const value = parseInt(slider.value);
    state.settings.minPrice = value;
    display.textContent = formatPrice(value);
    Storage.set('settings', state.settings);
    updateRecommendation();
    updatePriceButtonStyles();
  });

  // km당 최소 단가
  sliderPerKm.value = state.settings.minPricePerKm;
  displayPerKm.textContent = formatPrice(state.settings.minPricePerKm);

  sliderPerKm.addEventListener('input', () => {
    const value = parseInt(sliderPerKm.value);
    state.settings.minPricePerKm = value;
    displayPerKm.textContent = formatPrice(value);
    Storage.set('settings', state.settings);
    updateRecommendation();
    updatePricePerKmDisplay();
  });
}

// ==================== 빠른 입력 상태 ====================
const quickInput = {
  price: 0,
  distance: 0
};

// ==================== 콜 기록 ====================
function initCallInput() {
  const priceInput = document.getElementById('call-price');
  const distanceInput = document.getElementById('call-distance');
  const btnReject = document.getElementById('btn-reject');
  const btnAccept = document.getElementById('btn-accept');

  // 가격 입력 시 추천 업데이트
  priceInput.addEventListener('input', () => {
    quickInput.price = parseInt(priceInput.value) || 0;
    updateQuickInputDisplay();
    updateRecommendation();
  });

  distanceInput.addEventListener('input', () => {
    quickInput.distance = parseFloat(distanceInput.value) || 0;
    updateQuickInputDisplay();
  });

  btnReject.addEventListener('click', () => recordCall(false));
  btnAccept.addEventListener('click', () => recordCall(true));

  // 원터치 금액 버튼
  initQuickPriceButtons();

  // 원터치 거리 버튼
  initQuickDistanceButtons();
}

// ==================== 원터치 금액 버튼 ====================
function initQuickPriceButtons() {
  document.querySelectorAll('.quick-price-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const price = parseInt(btn.dataset.price);
      quickInput.price = price;

      // 버튼 선택 상태 업데이트
      document.querySelectorAll('.quick-price-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // 입력 필드에도 반영
      document.getElementById('call-price').value = price;

      updateQuickInputDisplay();
      updateRecommendation();
      vibrate(30);
    });
  });

  // 최소 단가 이하 버튼 표시
  updatePriceButtonStyles();
}

function updatePriceButtonStyles() {
  document.querySelectorAll('.quick-price-btn').forEach(btn => {
    const price = parseInt(btn.dataset.price);
    if (price < state.settings.minPrice) {
      btn.classList.add('below-min');
    } else {
      btn.classList.remove('below-min');
    }
  });
}

// ==================== 원터치 거리 버튼 ====================
function initQuickDistanceButtons() {
  document.querySelectorAll('.quick-distance-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const distance = parseFloat(btn.dataset.distance);
      quickInput.distance = distance;

      // 버튼 선택 상태 업데이트
      document.querySelectorAll('.quick-distance-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      // 입력 필드에도 반영
      document.getElementById('call-distance').value = distance;

      updateQuickInputDisplay();
      updateRecommendation();
      vibrate(30);
    });
  });
}

// ==================== 표시 업데이트 ====================
function updateQuickInputDisplay() {
  const priceDisplay = document.getElementById('selected-price-display');
  const distanceDisplay = document.getElementById('selected-distance-display');

  priceDisplay.textContent = quickInput.price > 0 ? formatPrice(quickInput.price) : '-';
  distanceDisplay.textContent = quickInput.distance > 0 ? quickInput.distance + 'km' : '-';

  // 거리당 단가 표시
  updatePricePerKmDisplay();

  // 버튼 활성화 상태
  const btnReject = document.getElementById('btn-reject');
  const btnAccept = document.getElementById('btn-accept');

  if (quickInput.price > 0) {
    btnReject.disabled = false;
    btnAccept.disabled = false;
  } else {
    btnReject.disabled = true;
    btnAccept.disabled = true;
  }
}

// ==================== 거리당 단가 표시 ====================
function updatePricePerKmDisplay() {
  const pricePerKmDisplay = document.getElementById('price-per-km-display');

  if (quickInput.price > 0 && quickInput.distance > 0) {
    const pricePerKm = Math.round(quickInput.price / quickInput.distance);
    pricePerKmDisplay.textContent = formatPrice(pricePerKm) + '/km';

    // 상태에 따른 색상
    pricePerKmDisplay.classList.remove('good', 'warning', 'bad');
    if (pricePerKm >= state.settings.minPricePerKm * 1.2) {
      pricePerKmDisplay.classList.add('good');
    } else if (pricePerKm >= state.settings.minPricePerKm) {
      pricePerKmDisplay.classList.add('warning');
    } else {
      pricePerKmDisplay.classList.add('bad');
    }
  } else {
    pricePerKmDisplay.textContent = '-';
    pricePerKmDisplay.classList.remove('good', 'warning', 'bad');
  }
}


// ==================== 진동 피드백 ====================
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

function updateRecommendation() {
  const price = quickInput.price || parseInt(document.getElementById('call-price').value) || 0;
  const distance = quickInput.distance || parseFloat(document.getElementById('call-distance').value) || 0;
  const recommendation = document.getElementById('call-recommendation');

  if (price === 0) {
    recommendation.classList.add('hidden');
    return;
  }

  recommendation.classList.remove('hidden');

  const isBelowMinPrice = price < state.settings.minPrice;
  const pricePerKm = distance > 0 ? Math.round(price / distance) : 0;
  const isBelowMinPricePerKm = distance > 0 && pricePerKm < state.settings.minPricePerKm;

  if (isBelowMinPrice && isBelowMinPricePerKm) {
    // 둘 다 미달
    recommendation.className = 'recommendation warn';
    recommendation.innerHTML = `
      <div>⚠️ <strong>거절 강력 권장!</strong></div>
      <div style="font-size:0.85rem; margin-top:4px;">
        최소 단가 미달 (${formatPrice(price)} < ${formatPrice(state.settings.minPrice)})<br>
        km당 단가 미달 (${formatPrice(pricePerKm)}/km < ${formatPrice(state.settings.minPricePerKm)}/km)
      </div>
    `;
  } else if (isBelowMinPrice) {
    // 최소 단가만 미달
    recommendation.className = 'recommendation warn';
    recommendation.textContent = `⚠️ 최소 단가(${formatPrice(state.settings.minPrice)}) 미달. 거절 권장!`;
  } else if (isBelowMinPricePerKm) {
    // km당 단가만 미달
    recommendation.className = 'recommendation warn';
    recommendation.innerHTML = `
      <div>⚠️ km당 단가 미달</div>
      <div style="font-size:0.85rem; margin-top:4px;">
        ${formatPrice(pricePerKm)}/km < ${formatPrice(state.settings.minPricePerKm)}/km
      </div>
    `;
  } else if (distance > 0) {
    // 둘 다 충족
    recommendation.className = 'recommendation good';
    recommendation.innerHTML = `
      <div>✓ 적정 콜</div>
      <div style="font-size:0.85rem; margin-top:4px;">
        ${formatPrice(pricePerKm)}/km (기준: ${formatPrice(state.settings.minPricePerKm)}/km)
      </div>
    `;
  } else {
    // 거리 미입력, 단가만 체크
    recommendation.className = 'recommendation good';
    recommendation.textContent = `✓ 최소 단가 충족 (거리 선택 시 상세 분석)`;
  }
}

function recordCall(accepted) {
  // quickInput 상태 또는 직접 입력 필드에서 값 가져오기
  const price = quickInput.price || parseInt(document.getElementById('call-price').value) || 0;
  const distance = quickInput.distance || parseFloat(document.getElementById('call-distance').value) || 0;
  const store = document.getElementById('call-store').value.trim();

  if (!price) {
    alert('단가를 먼저 선택해주세요');
    vibrate([100, 50, 100]);
    return;
  }

  const call = {
    id: Date.now(),
    price,
    distance,
    store,
    accepted,
    timestamp: new Date().toISOString(),
    date: getToday()
  };

  state.calls.unshift(call);
  Storage.set('calls', state.calls);

  // 입력 초기화
  quickInput.price = 0;
  quickInput.distance = 0;
  document.getElementById('call-price').value = '';
  document.getElementById('call-distance').value = '';
  document.getElementById('call-store').value = '';
  document.getElementById('call-recommendation').classList.add('hidden');

  // 버튼 선택 해제
  document.querySelectorAll('.quick-price-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.quick-distance-btn').forEach(b => b.classList.remove('selected'));
  updateQuickInputDisplay();

  // 피드백
  if (accepted) {
    vibrate([50, 30, 50, 30, 50]);
  } else {
    vibrate(100);
  }

  // 토스트 메시지 표시
  showToast(accepted ? `✓ ${formatPrice(price)} 수락 기록` : `✕ ${formatPrice(price)} 거절 기록`);

  renderCallList();
  updateDashboard();
  checkLoyaltyWarning();
}

// ==================== 토스트 메시지 ====================
function showToast(message) {
  // 기존 토스트 제거
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function renderCallList() {
  const list = document.getElementById('call-list');
  const todayCalls = state.calls.filter(c => c.date === getToday());

  if (todayCalls.length === 0) {
    list.innerHTML = '<p class="empty-state">아직 기록이 없습니다</p>';
    return;
  }

  list.innerHTML = todayCalls.slice(0, 20).map(call => `
    <div class="call-item ${call.accepted ? 'accepted' : 'rejected'}">
      <div class="call-info">
        <div class="call-price">${formatPrice(call.price)}</div>
        <div class="call-details">
          ${call.distance ? call.distance + 'km' : ''}
          ${call.store ? ' · ' + call.store : ''}
          ${call.distance && call.price ? ' · ' + formatPrice(Math.round(call.price / call.distance)) + '/km' : ''}
        </div>
      </div>
      <span class="call-status ${call.accepted ? 'accepted' : 'rejected'}">
        ${call.accepted ? '수락' : '거절'}
      </span>
    </div>
  `).join('');
}

// ==================== 대시보드 ====================
function updateDashboard() {
  const todayCalls = state.calls.filter(c => c.date === getToday());
  const acceptedCalls = todayCalls.filter(c => c.accepted);

  // 평균 단가
  const avgPrice = acceptedCalls.length > 0
    ? Math.round(acceptedCalls.reduce((sum, c) => sum + c.price, 0) / acceptedCalls.length)
    : 0;
  document.getElementById('avg-price').textContent = formatPrice(avgPrice);

  // 수락률
  const acceptRate = todayCalls.length > 0
    ? Math.round((acceptedCalls.length / todayCalls.length) * 100)
    : 0;
  document.getElementById('accept-rate').textContent = acceptRate + '%';

  // 오늘 수익
  const todayEarnings = acceptedCalls.reduce((sum, c) => sum + c.price, 0);
  document.getElementById('today-earnings').textContent = formatPrice(todayEarnings);

  // 앱 사용 시간
  const totalSeconds = Object.values(state.timers).reduce((sum, t) => sum + t.seconds, 0);
  document.getElementById('app-timer').textContent = formatTime(totalSeconds);
}

function checkLoyaltyWarning() {
  const todayCalls = state.calls.filter(c => c.date === getToday());
  const acceptRate = todayCalls.length > 0
    ? (todayCalls.filter(c => c.accepted).length / todayCalls.length) * 100
    : 0;

  const warning = document.getElementById('loyalty-warning');
  if (todayCalls.length >= 5 && acceptRate >= 80) {
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }
}

// ==================== 현장 메모 ====================
function initMemo() {
  // 메모 타입 선택
  document.querySelectorAll('.memo-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.memo-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentMemoType = btn.dataset.type;
    });
  });

  // 메모 저장
  document.getElementById('btn-save-memo').addEventListener('click', saveMemo);

  // 메모 검색
  document.getElementById('memo-search-input').addEventListener('input', (e) => {
    renderMemoList(e.target.value);
  });

  // 음성 입력 초기화
  initMemoVoiceInput();

  renderMemoList();
}

// ==================== 실시간 채팅 ====================
let chatInitialized = false;

function initChat() {
  if (chatInitialized) return;
  chatInitialized = true;

  const regionSelect = document.getElementById('chat-region');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  const messagesContainer = document.getElementById('chat-messages');

  // 저장된 지역 복원
  regionSelect.value = state.currentRegion;

  // Firebase 확인
  const firebaseReady = initFirebase();

  if (!firebaseReady) {
    // Firebase 없으면 로컬 데모 모드
    messagesContainer.innerHTML = `
      <p class="chat-notice">📡 데모 모드</p>
      <div class="chat-message other">
        <div class="chat-message-header">
          <span class="chat-nickname">👻 시스템</span>
          <span class="chat-time">방금</span>
        </div>
        <div class="chat-text">Firebase 설정 후 실시간 채팅이 활성화됩니다. 현재는 로컬 테스트 모드입니다.</div>
      </div>
    `;
    setupLocalChat();
    return;
  }

  // 지역 변경 시 채팅방 전환
  regionSelect.addEventListener('change', () => {
    state.currentRegion = regionSelect.value;
    Storage.set('currentRegion', state.currentRegion);
    loadChatMessages();
  });

  // 메시지 전송
  btnSend.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // 채팅 메시지 로드
  loadChatMessages();
}

function setupLocalChat() {
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  const messagesContainer = document.getElementById('chat-messages');

  const localMessages = Storage.get(`chat_${state.currentRegion}`, []);
  renderLocalMessages(localMessages);

  const sendLocal = () => {
    const text = chatInput.value.trim();
    if (!text) return;

    const message = {
      id: Date.now(),
      text,
      nickname: state.nickname,
      oderId: state.oderId,
      timestamp: Date.now()
    };

    localMessages.push(message);
    if (localMessages.length > 50) localMessages.shift();
    Storage.set(`chat_${state.currentRegion}`, localMessages);

    chatInput.value = '';
    renderLocalMessages(localMessages);
    vibrate(30);
  };

  btnSend.addEventListener('click', sendLocal);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendLocal();
    }
  });

  // 지역 변경
  document.getElementById('chat-region').addEventListener('change', (e) => {
    state.currentRegion = e.target.value;
    Storage.set('currentRegion', state.currentRegion);
    const msgs = Storage.get(`chat_${state.currentRegion}`, []);
    renderLocalMessages(msgs);
  });
}

function renderLocalMessages(messages) {
  const container = document.getElementById('chat-messages');

  if (messages.length === 0) {
    container.innerHTML = `
      <p class="chat-notice">아직 메시지가 없습니다.<br>첫 메시지를 남겨보세요!</p>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isMine = msg.oderId === state.oderId;
    const time = formatChatTime(msg.timestamp);
    return `
      <div class="chat-message ${isMine ? 'mine' : 'other'}">
        <div class="chat-message-header">
          <span class="chat-nickname">👻 ${msg.nickname}</span>
          <span class="chat-time">${time}</span>
        </div>
        <div class="chat-text">${escapeHtml(msg.text)}</div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function loadChatMessages() {
  if (!db) return;

  const messagesContainer = document.getElementById('chat-messages');
  messagesContainer.innerHTML = '<p class="chat-notice">메시지 로딩 중...</p>';

  // 기존 구독 해제
  if (chatUnsubscribe) {
    chatUnsubscribe();
  }

  // 실시간 구독
  chatUnsubscribe = db.collection('chats')
    .doc(state.currentRegion)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      const messages = [];
      snapshot.forEach(doc => {
        messages.unshift({ id: doc.id, ...doc.data() });
      });
      renderChatMessages(messages);
    }, (error) => {
      console.error('채팅 로드 오류:', error);
      messagesContainer.innerHTML = '<p class="chat-notice">채팅 연결 오류</p>';
    });
}

function renderChatMessages(messages) {
  const container = document.getElementById('chat-messages');

  if (messages.length === 0) {
    container.innerHTML = `
      <p class="chat-notice">아직 메시지가 없습니다.<br>첫 메시지를 남겨보세요!</p>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => {
    const isMine = msg.oderId === state.oderId;
    const time = formatChatTime(msg.timestamp?.toDate?.() || msg.timestamp);
    return `
      <div class="chat-message ${isMine ? 'mine' : 'other'}">
        <div class="chat-message-header">
          <span class="chat-nickname">👻 ${msg.nickname || '익명'}</span>
          <span class="chat-time">${time}</span>
        </div>
        <div class="chat-text">${escapeHtml(msg.text)}</div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  const text = chatInput.value.trim();

  if (!text || !db) return;

  const message = {
    text,
    nickname: state.nickname,
    oderId: state.oderId,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('chats')
    .doc(state.currentRegion)
    .collection('messages')
    .add(message)
    .then(() => {
      chatInput.value = '';
      vibrate(30);
    })
    .catch(err => {
      console.error('메시지 전송 오류:', err);
      alert('메시지 전송에 실패했습니다.');
    });
}

function formatChatTime(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '방금';
  if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '시간 전';
  return date.toLocaleDateString('ko-KR');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 메모 음성 입력 ====================
function initMemoVoiceInput() {
  // Web Speech API 지원 확인
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    document.getElementById('btn-place-voice').textContent = '🚫';
    document.getElementById('btn-place-voice').disabled = true;
    document.getElementById('btn-memo-voice').textContent = '🚫';
    document.getElementById('btn-memo-voice').disabled = true;
    return;
  }

  // 장소명 음성 입력
  setupVoiceInput({
    btnId: 'btn-place-voice',
    inputId: 'memo-place',
    statusId: 'place-voice-status',
    isTextarea: false
  });

  // 내용 음성 입력
  setupVoiceInput({
    btnId: 'btn-memo-voice',
    inputId: 'memo-content',
    statusId: 'memo-voice-status',
    isTextarea: true
  });
}

function setupVoiceInput({ btnId, inputId, statusId, isTextarea }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const status = document.getElementById(statusId);

  const recognition = new SpeechRecognition();
  recognition.lang = 'ko-KR';
  recognition.continuous = isTextarea;
  recognition.interimResults = true;

  let isListening = false;
  let finalTranscript = '';

  btn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      return;
    }

    finalTranscript = input.value;
    recognition.start();
    isListening = true;
    btn.classList.add('listening');
    status.textContent = '🎤 듣고 있습니다...';
    vibrate(50);
  });

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        if (isTextarea) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
        } else {
          finalTranscript = transcript; // 단일 입력은 덮어쓰기
        }
      } else {
        interimTranscript += transcript;
      }
    }

    if (isTextarea) {
      input.value = finalTranscript + (interimTranscript ? ' ' + interimTranscript : '');
    } else {
      input.value = finalTranscript || interimTranscript;
    }
    status.textContent = '🎤 ' + (interimTranscript || '듣고 있습니다...');
  };

  recognition.onerror = (event) => {
    if (event.error === 'no-speech') {
      status.textContent = '음성이 감지되지 않았습니다';
    } else {
      status.textContent = '인식 오류';
    }
  };

  recognition.onend = () => {
    isListening = false;
    btn.classList.remove('listening');

    if (input.value.trim()) {
      status.textContent = '✓ 입력 완료';
      vibrate([50, 30, 50]);
    } else {
      status.textContent = '';
    }

    setTimeout(() => {
      status.textContent = '';
    }, 2000);
  };
}

function saveMemo() {
  const place = document.getElementById('memo-place').value.trim();
  const content = document.getElementById('memo-content').value.trim();

  if (!place || !content) {
    alert('장소명과 내용을 입력해주세요');
    return;
  }

  const memo = {
    id: Date.now(),
    place,
    content,
    type: state.currentMemoType,
    timestamp: new Date().toISOString()
  };

  state.memos.unshift(memo);
  Storage.set('memos', state.memos);

  document.getElementById('memo-place').value = '';
  document.getElementById('memo-content').value = '';

  renderMemoList();
}

function renderMemoList(searchQuery = '') {
  const list = document.getElementById('memo-list');
  let memos = state.memos;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    memos = memos.filter(m =>
      m.place.toLowerCase().includes(query) ||
      m.content.toLowerCase().includes(query)
    );
  }

  if (memos.length === 0) {
    list.innerHTML = '<p class="empty-state">저장된 메모가 없습니다</p>';
    return;
  }

  const typeLabels = {
    store: '🏪 가게',
    destination: '🏠 도착지',
    blacklist: '⚫ 블랙',
    tip: '💡 꿀팁',
    // 이전 버전 호환
    location: '📍 위치',
    password: '🔐 비번'
  };

  list.innerHTML = memos.map(memo => `
    <div class="memo-item" data-id="${memo.id}">
      <div class="memo-header">
        <span class="memo-place">${memo.place}</span>
        <span class="memo-type">${typeLabels[memo.type] || memo.type}</span>
      </div>
      <div class="memo-content">${memo.content}</div>
      <button class="memo-delete" onclick="deleteMemo(${memo.id})">×</button>
    </div>
  `).join('');
}

window.deleteMemo = function(id) {
  state.memos = state.memos.filter(m => m.id !== id);
  Storage.set('memos', state.memos);
  renderMemoList();
};

// ==================== 피로도 타이머 ====================
function initTimers() {
  document.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleTimer(btn.dataset.app));
  });

  document.getElementById('btn-rest').addEventListener('click', stopAllTimers);

  // 저장된 타이머 복원
  Object.keys(state.timers).forEach(app => {
    const timer = state.timers[app];
    if (timer.running && timer.startTime) {
      // 실행 중이었던 타이머 재시작
      const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
      state.timers[app].seconds += elapsed;
      state.timers[app].startTime = Date.now();
    }
    updateTimerDisplay(app);
  });

  // 매초 업데이트
  setInterval(updateAllTimers, 1000);
}

function toggleTimer(app) {
  const timer = state.timers[app];
  const btn = document.querySelector(`.timer-btn[data-app="${app}"]`);
  const card = document.querySelector(`.app-timer-card[data-app="${app}"]`);

  if (timer.running) {
    // 정지
    timer.running = false;
    timer.startTime = null;
    btn.textContent = '시작';
    btn.classList.remove('running');
    card.classList.remove('active');
  } else {
    // 시작 (다른 타이머는 정지)
    Object.keys(state.timers).forEach(a => {
      if (a !== app && state.timers[a].running) {
        state.timers[a].running = false;
        state.timers[a].startTime = null;
        document.querySelector(`.timer-btn[data-app="${a}"]`).textContent = '시작';
        document.querySelector(`.timer-btn[data-app="${a}"]`).classList.remove('running');
        document.querySelector(`.app-timer-card[data-app="${a}"]`).classList.remove('active');
      }
    });

    timer.running = true;
    timer.startTime = Date.now();
    btn.textContent = '정지';
    btn.classList.add('running');
    card.classList.add('active');
  }

  Storage.set('timers', state.timers);
}

function stopAllTimers() {
  Object.keys(state.timers).forEach(app => {
    state.timers[app].running = false;
    state.timers[app].startTime = null;
    document.querySelector(`.timer-btn[data-app="${app}"]`).textContent = '시작';
    document.querySelector(`.timer-btn[data-app="${app}"]`).classList.remove('running');
    document.querySelector(`.app-timer-card[data-app="${app}"]`).classList.remove('active');
  });

  Storage.set('timers', state.timers);

  // 휴식 상태 표시
  const restStatus = document.getElementById('rest-status');
  restStatus.innerHTML = '<p>🛑 휴식 중... 30분 후 좋은 콜 가능성 ↑</p>';
  restStatus.classList.add('warning');
}

function updateAllTimers() {
  Object.keys(state.timers).forEach(app => {
    const timer = state.timers[app];
    if (timer.running && timer.startTime) {
      const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
      const totalSeconds = timer.seconds + elapsed;
      document.getElementById(`${app}-time`).textContent = formatTime(totalSeconds);

      // 타이머 카드 경고 스타일
      const card = document.querySelector(`.app-timer-card[data-app="${app}"]`);
      if (totalSeconds >= 7200) {
        card.classList.add('warning');
      } else {
        card.classList.remove('warning');
      }

      // 2시간 도달 시 알림 (정확히 2시간일 때 1번만)
      if (totalSeconds === 7200) {
        showFatigueWarning(app);
      }

      // 이후 30분마다 재알림
      if (totalSeconds > 7200 && totalSeconds % 1800 === 0) {
        showFatigueWarning(app);
      }

      updateRestRecommendation(app, totalSeconds);
    }
  });

  updateDashboard();
}

// ==================== 피로도 경고 알림 ====================
function showFatigueWarning(app) {
  const appNames = { baemin: '배민', coupang: '쿠팡이츠', yogiyo: '요기요' };
  const appName = appNames[app];

  // 진동 알림 (긴 패턴)
  vibrate([200, 100, 200, 100, 200]);

  // 토스트 메시지
  showToast(`⚠️ ${appName} 2시간 이상! 앱 전환 권장`);

  // 휴식 상태 업데이트
  const restStatus = document.getElementById('rest-status');
  restStatus.innerHTML = `
    <p>⚠️ <strong>${appName}</strong> 장시간 사용 중!</p>
    <p style="font-size:0.85rem; margin-top:6px;">
      알고리즘이 피로도를 감지할 수 있습니다.<br>
      다른 앱으로 전환하거나 휴식하세요.
    </p>
  `;
  restStatus.classList.add('warning');

  // 브라우저 알림 (권한 있을 경우)
  if (Notification.permission === 'granted') {
    new Notification('고스트라이더 피로도 경고', {
      body: `${appName} 2시간 이상 사용 중! 앱 전환을 권장합니다.`,
      icon: '👻',
      tag: 'fatigue-warning'
    });
  }
}

// 알림 권한 요청
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function updateTimerDisplay(app) {
  const timer = state.timers[app];
  document.getElementById(`${app}-time`).textContent = formatTime(timer.seconds);

  if (timer.running) {
    document.querySelector(`.timer-btn[data-app="${app}"]`).textContent = '정지';
    document.querySelector(`.timer-btn[data-app="${app}"]`).classList.add('running');
    document.querySelector(`.app-timer-card[data-app="${app}"]`).classList.add('active');
  }
}

function updateRestRecommendation(app, seconds) {
  const restStatus = document.getElementById('rest-status');
  const appNames = { baemin: '배민', coupang: '쿠팡이츠', yogiyo: '요기요' };

  if (seconds >= 7200) {
    restStatus.innerHTML = `<p>⚠️ ${appNames[app]} 2시간 이상 사용 중! 다른 앱으로 전환하거나 휴식을 권장합니다.</p>`;
    restStatus.classList.add('warning');
  }
}

// ==================== 분석 통계 ====================
function initStats() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentPeriod = btn.dataset.period;
      updateStats();
    });
  });

  // 지출 타입 선택
  document.querySelectorAll('.expense-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.expense-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentExpenseType = btn.dataset.type;
    });
  });

  // 지출 추가
  document.getElementById('btn-add-expense').addEventListener('click', addExpense);
  document.getElementById('expense-amount').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addExpense();
  });

  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-clear').addEventListener('click', clearData);
}

// ==================== 지출 관리 ====================
function addExpense() {
  const amountInput = document.getElementById('expense-amount');
  const memoInput = document.getElementById('expense-memo');
  const amount = parseInt(amountInput.value);

  if (!amount || amount <= 0) {
    alert('금액을 입력해주세요');
    return;
  }

  const expense = {
    id: Date.now(),
    type: state.currentExpenseType,
    amount,
    memo: memoInput.value.trim(),
    date: getToday(),
    timestamp: new Date().toISOString()
  };

  state.expenses.push(expense);
  Storage.set('expenses', state.expenses);

  amountInput.value = '';
  memoInput.value = '';

  vibrate(30);
  showToast(`💸 ${formatPrice(amount)} 지출 기록`);

  updateStats();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  Storage.set('expenses', state.expenses);
  updateStats();
}

// 전역에서 삭제 함수 접근 가능하게
window.deleteExpense = deleteExpense;

function renderExpenseList(expenses) {
  const list = document.getElementById('expense-list');
  const typeIcons = { food: '🍚', fuel: '⛽', other: '📦' };
  const typeNames = { food: '식대', fuel: '유류비', other: '기타' };

  if (expenses.length === 0) {
    list.innerHTML = '<p class="empty-state">지출 내역이 없습니다</p>';
    return;
  }

  list.innerHTML = expenses.slice().reverse().map(exp => `
    <div class="expense-item">
      <div class="expense-item-info">
        <span class="expense-item-type">${typeIcons[exp.type]}</span>
        <div class="expense-item-detail">
          <div class="expense-item-amount">${formatPrice(exp.amount)}</div>
          ${exp.memo ? `<div class="expense-item-memo">${exp.memo}</div>` : ''}
        </div>
      </div>
      <button class="expense-item-delete" onclick="deleteExpense(${exp.id})">×</button>
    </div>
  `).join('');
}

function updateStats() {
  let startDate;
  switch (state.currentPeriod) {
    case 'today':
      startDate = getToday();
      break;
    case 'week':
      startDate = getWeekStart();
      break;
    case 'month':
      startDate = getMonthStart();
      break;
  }

  const filteredCalls = state.calls.filter(c => c.date >= startDate);
  const acceptedCalls = filteredCalls.filter(c => c.accepted);
  const filteredExpenses = state.expenses.filter(e => e.date >= startDate);

  // 총 수익
  const totalEarnings = acceptedCalls.reduce((sum, c) => sum + c.price, 0);
  document.getElementById('stats-earnings').textContent = formatPrice(totalEarnings);

  // 총 지출
  const totalExpense = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  document.getElementById('stats-expense').textContent = formatPrice(totalExpense);

  // 순수익
  const netIncome = totalEarnings - totalExpense;
  const netElement = document.getElementById('stats-net');
  netElement.textContent = formatPrice(Math.abs(netIncome));
  if (netIncome < 0) {
    netElement.textContent = '-' + netElement.textContent;
    netElement.style.color = 'var(--danger)';
  } else {
    netElement.style.color = 'var(--accent)';
  }

  // 지출 내역 렌더링
  renderExpenseList(filteredExpenses);

  // 배달 건수
  document.getElementById('stats-deliveries').textContent = acceptedCalls.length + '건';

  // 평균 단가
  const avgPrice = acceptedCalls.length > 0
    ? Math.round(totalEarnings / acceptedCalls.length)
    : 0;
  document.getElementById('stats-avg-price').textContent = formatPrice(avgPrice);

  // 거리당 단가
  const totalDistance = acceptedCalls.reduce((sum, c) => sum + (c.distance || 0), 0);
  const pricePerKm = totalDistance > 0
    ? Math.round(totalEarnings / totalDistance)
    : 0;
  document.getElementById('stats-price-per-km').textContent = formatPrice(pricePerKm) + '/km';

  // 수락률
  const acceptRate = filteredCalls.length > 0
    ? Math.round((acceptedCalls.length / filteredCalls.length) * 100)
    : 0;
  document.getElementById('stats-accept-rate').textContent = acceptRate + '%';

  // 충성도 분석
  updateLoyaltyAnalysis(acceptRate, filteredCalls.length);
}

function updateLoyaltyAnalysis(acceptRate, totalCalls) {
  const fill = document.getElementById('loyalty-fill');
  const advice = document.getElementById('loyalty-advice');

  fill.style.width = acceptRate + '%';

  if (totalCalls < 5) {
    advice.textContent = '데이터가 충분하지 않습니다. 콜을 더 기록해주세요.';
  } else if (acceptRate >= 80) {
    advice.textContent = '⚠️ 수락률이 너무 높습니다! 알고리즘이 당신을 "고절박도"로 분류할 수 있습니다. 저단가 콜은 과감히 거절하세요.';
  } else if (acceptRate >= 60) {
    advice.textContent = '수락률이 적정 수준입니다. 최소 단가 기준을 유지하세요.';
  } else {
    advice.textContent = '✓ 수락률이 낮습니다. 알고리즘이 당신에게 더 좋은 콜을 줄 가능성이 높습니다!';
  }
}

function exportData() {
  const data = {
    calls: state.calls,
    memos: state.memos,
    expenses: state.expenses,
    settings: state.settings,
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ghostrider_backup_${getToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearData() {
  if (confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    state.calls = [];
    state.memos = [];
    state.expenses = [];
    state.timers = {
      baemin: { running: false, seconds: 0, startTime: null },
      coupang: { running: false, seconds: 0, startTime: null },
      yogiyo: { running: false, seconds: 0, startTime: null }
    };

    Storage.set('calls', state.calls);
    Storage.set('memos', state.memos);
    Storage.set('expenses', state.expenses);
    Storage.set('timers', state.timers);

    renderCallList();
    renderMemoList();
    updateDashboard();
    updateStats();

    Object.keys(state.timers).forEach(updateTimerDisplay);

    alert('데이터가 초기화되었습니다.');
  }
}

// ==================== 앱 초기화 ====================
function init() {
  initTabs();
  initMinPriceSlider();
  initCallInput();
  initMemo();
  initTimers();
  initStats();

  renderCallList();
  updateDashboard();
  checkLoyaltyWarning();

  // 빠른 입력 초기화
  updateQuickInputDisplay();
  updatePriceButtonStyles();

  // 알림 권한 요청
  requestNotificationPermission();
}

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', init);
