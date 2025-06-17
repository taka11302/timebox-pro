// タイムボックスアプリ v2 JavaScript（自動復旧機能付き）

// アプリの状態
let timeboxes = [];
let isRunning = false;
let startTime = null;
let currentTime = null;
let currentDetail = '';
let timer = null;
let currentView = 'list';
let selectedDate = new Date();

// DOM要素
const lapButton = document.getElementById('lapButton');
const timerDisplay = document.getElementById('timerDisplay');
const currentTimeEl = document.getElementById('currentTime');
const currentDetailEl = document.getElementById('currentDetail');
const timeboxList = document.getElementById('timeboxList');
const searchInput = document.getElementById('searchInput');
const clearButton = document.getElementById('clearButton');

// タブとビュー要素
const listTab = document.getElementById('listTab');
const timelineTab = document.getElementById('timelineTab');
const listView = document.getElementById('listView');
const timelineView = document.getElementById('timelineView');

// タイムライン要素
const prevDayButton = document.getElementById('prevDay');
const nextDayButton = document.getElementById('nextDay');
const todayButton = document.getElementById('todayButton');
const currentDateEl = document.getElementById('currentDate');
const timelineContent = document.getElementById('timelineContent');
const totalTimeEl = document.getElementById('totalTime');
const totalRecordsEl = document.getElementById('totalRecords');

// 初期化
function init() {
  loadTimeboxes();
  checkForInterruptedTimer();
  setupEventListeners();
  renderCurrentView();
  updateClearButtonVisibility();
}

// 中断されたタイマーのチェック
function checkForInterruptedTimer() {
  const savedTimerState = localStorage.getItem('timerState');
  if (savedTimerState) {
    try {
      const timerState = JSON.parse(savedTimerState);
      const now = new Date();
      const lastStartTime = new Date(timerState.startTime);
      const lastDetail = timerState.detail || '';
      
      // 5分以上前の記録の場合のみ復旧オプションを表示
      const timeSinceStart = now - lastStartTime;
      if (timeSinceStart > 5 * 60 * 1000) { // 5分以上
        showRecoveryDialog(lastStartTime, lastDetail, now);
      } else {
        // 5分以内の場合は自動的に継続
        resumeTimer(lastStartTime, lastDetail);
      }
    } catch (e) {
      console.error('タイマー状態の復元に失敗しました', e);
      localStorage.removeItem('timerState');
    }
  }
}

// 復旧ダイアログの表示
function showRecoveryDialog(lastStartTime, lastDetail, currentTime) {
  const timeDiff = currentTime - lastStartTime;
  const diffMinutes = Math.floor(timeDiff / (60 * 1000));
  const startTimeStr = formatTime(lastStartTime);
  
  const message = `計測が中断されました。\n${startTimeStr}から継続しますか？\n（約${diffMinutes}分前）`;
  
  if (confirm(message)) {
    resumeTimer(lastStartTime, lastDetail);
  } else {
    // 復旧を拒否した場合、保存された状態をクリア
    localStorage.removeItem('timerState');
  }
}

// タイマーの復旧
function resumeTimer(lastStartTime, lastDetail) {
  isRunning = true;
  startTime = lastStartTime;
  currentTime = new Date();
  currentDetail = lastDetail;
  
  lapButton.textContent = 'ラップ';
  timerDisplay.classList.remove('hidden');
  currentDetailEl.value = currentDetail;
  
  startTimer();
  updateTimerDisplay();
}

// データの読み込み
function loadTimeboxes() {
  const savedTimeboxes = localStorage.getItem('timeboxes');
  if (savedTimeboxes) {
    try {
      const parsed = JSON.parse(savedTimeboxes);
      timeboxes = parsed.map(box => ({
        ...box,
        timeA: box.timeA ? new Date(box.timeA) : null,
        timeC: box.timeC ? new Date(box.timeC) : null
      }));
    } catch (e) {
      console.error('データの復元に失敗しました', e);
    }
  }
}

// データの保存
function saveTimeboxes() {
  localStorage.setItem('timeboxes', JSON.stringify(timeboxes));
}

// タイマー状態の保存
function saveTimerState() {
  if (isRunning && startTime) {
    const timerState = {
      startTime: startTime.toISOString(),
      detail: currentDetail,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('timerState', JSON.stringify(timerState));
  } else {
    localStorage.removeItem('timerState');
  }
}

// イベントリスナーのセットアップ
function setupEventListeners() {
  // 既存のイベントリスナー
  lapButton.addEventListener('click', handleLapClick);
  currentDetailEl.addEventListener('input', (e) => {
    currentDetail = e.target.value;
    saveTimerState(); // 詳細変更時にも状態を保存
  });
  searchInput.addEventListener('input', renderTimeboxes);
  clearButton.addEventListener('click', clearAll);

  // タブ切り替え
  listTab.addEventListener('click', () => switchView('list'));
  timelineTab.addEventListener('click', () => switchView('timeline'));

  // タイムライン日付ナビゲーション
  prevDayButton.addEventListener('click', () => changeDate(-1));
  nextDayButton.addEventListener('click', () => changeDate(1));
  todayButton.addEventListener('click', goToToday);

  // ページを離れる前に状態を保存
  window.addEventListener('beforeunload', () => {
    saveTimerState();
  });

  // ページが非表示になる時に状態を保存
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveTimerState();
    }
  });
}

// ビュー切り替え
function switchView(view) {
  currentView = view;
  
  // タブの表示更新
  listTab.classList.toggle('active', view === 'list');
  timelineTab.classList.toggle('active', view === 'timeline');
  
  // ビューの表示更新
  listView.classList.toggle('hidden', view !== 'list');
  timelineView.classList.toggle('hidden', view !== 'timeline');
  
  renderCurrentView();
}

// 現在のビューをレンダリング
function renderCurrentView() {
  if (currentView === 'list') {
    renderTimeboxes();
  } else {
    renderTimeline();
  }
}

// ラップボタンクリック処理
function handleLapClick() {
  const now = new Date();
  
  if (!isRunning) {
    // タイマーを開始
    isRunning = true;
    startTime = now;
    currentTime = now;
    lapButton.textContent = 'ラップ';
    timerDisplay.classList.remove('hidden');
    startTimer();
    saveTimerState();
  } else {
    // ラップを記録
    const newTimebox = {
      id: Date.now(),
      timeA: startTime,
      timeC: now,
      detail: currentDetail,
      timeD: now - startTime
    };
    timeboxes.unshift(newTimebox);
    saveTimeboxes();
    startTime = now;
    currentDetail = '';
    currentDetailEl.value = '';
    renderCurrentView();
    updateClearButtonVisibility();
    saveTimerState();
  }
}

// タイマー開始
function startTimer() {
  timer = setInterval(() => {
    currentTime = new Date();
    updateTimerDisplay();
    // 30秒ごとに状態を保存
    if (Math.floor(currentTime.getTime() / 1000) % 30 === 0) {
      saveTimerState();
    }
  }, 100);
}

// タイマー表示の更新
function updateTimerDisplay() {
  if (isRunning && startTime && currentTime) {
    currentTimeEl.textContent = formatDuration(currentTime - startTime);
  }
}

// タイムボックス一覧のレンダリング（リスト表示）
function renderTimeboxes() {
  const searchTerm = searchInput.value.toLowerCase();
  const filteredTimeboxes = timeboxes.filter(box => 
    box.detail.toLowerCase().includes(searchTerm)
  );
  
  if (filteredTimeboxes.length === 0) {
    timeboxList.innerHTML = '<li class="empty-message">ラップボタンを押して記録を開始しましょう</li>';
    return;
  }
  
  timeboxList.innerHTML = '';
  filteredTimeboxes.forEach(box => {
    const li = document.createElement('li');
    li.className = 'timebox-item';
    
    const header = document.createElement('div');
    header.className = 'timebox-header';
    
    const date = document.createElement('span');
    date.className = 'timebox-date';
    date.textContent = formatDate(box.timeA);
    
    const timeA = document.createElement('span');
    timeA.textContent = formatTime(box.timeA);
    
    const arrow = document.createElement('span');
    arrow.className = 'time-arrow';
    arrow.textContent = '→';
    
    const timeC = document.createElement('span');
    timeC.textContent = formatTime(box.timeC);
    
    const duration = document.createElement('span');
    duration.className = 'timebox-duration';
    duration.textContent = formatDuration(box.timeD);
    
    header.appendChild(date);
    header.appendChild(timeA);
    header.appendChild(arrow);
    header.appendChild(timeC);
    header.appendChild(duration);
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'timebox-detail-input';
    input.placeholder = '詳細を入力（タップして編集）';
    input.value = box.detail;
    input.title = box.detail; // ホバー時に全文表示
    input.addEventListener('input', (e) => {
      box.detail = e.target.value;
      saveTimeboxes();
    });
    
    li.appendChild(header);
    li.appendChild(input);
    timeboxList.appendChild(li);
  });
}

// 文字数制限付きテキスト
function truncateText(text, maxLength = 17) {
  if (!text) return '詳細なし';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 時間帯別のタイムボックス取得
function getHourTimeboxes(timeboxes, hour, selectedDate) {
  const hourStart = new Date(selectedDate);
  hourStart.setHours(hour, 0, 0, 0);
  const hourEnd = new Date(selectedDate);
  hourEnd.setHours(hour, 59, 59, 999);
  
  const hourTimeboxes = [];
  
  timeboxes.forEach(box => {
    // この時間帯と重複する記録をチェック
    if (box.timeA <= hourEnd && box.timeC >= hourStart) {
      // この時間帯での開始・終了時刻を計算
      const blockStart = box.timeA > hourStart ? box.timeA : hourStart;
      const blockEnd = box.timeC < hourEnd ? box.timeC : hourEnd;
      const hourDuration = blockEnd - blockStart;
      
      // 表示テキストを決定
      let displayText = box.detail || '詳細なし';
      let timeText = '';
      
      if (box.timeA >= hourStart && box.timeC <= hourEnd) {
        // この時間帯内で完結
        timeText = `${formatTime(box.timeA)}`;
      } else if (box.timeA >= hourStart && box.timeC > hourEnd) {
        // この時間帯で開始、次の時間帯に続く
        timeText = `(${formatTime(box.timeA)}~)`;
      } else if (box.timeA < hourStart && box.timeC <= hourEnd) {
        // 前の時間帯から継続、この時間帯で終了
        displayText = `(続き ~${formatTime(box.timeC)})`;
        timeText = '';
      } else {
        // 前の時間帯から継続、次の時間帯にも続く
        displayText = '(続き)';
        timeText = '';
      }
      
      hourTimeboxes.push({
        ...box,
        displayText: truncateText(displayText),
        timeText,
        hourDuration,
        startTime: box.timeA
      });
    }
  });
  
  // 開始時刻順にソート
  return hourTimeboxes.sort((a, b) => a.startTime - b.startTime);
}

// 1時間分のタイムボックスを描画
function renderHourTimeboxes(hourTimeboxes) {
  if (hourTimeboxes.length === 0) {
    return '';
  }
  
  let html = '';
  
  hourTimeboxes.forEach((box, index) => {
    const maxWidth = 200;
    const barWidth = Math.max(8, (box.hourDuration / (60 * 60 * 1000)) * maxWidth);
    
    html += `
      <div class="timeline-block">
        <div class="block-bar" style="width: ${barWidth}px;"></div>
        <div class="block-content">
          <div class="block-detail" title="${box.detail || '詳細なし'}">${box.displayText}</div>
          <div class="block-time">
            ${box.timeText}
            <span class="block-duration">${formatDurationShort(box.hourDuration)}</span>
          </div>
        </div>
      </div>
    `;
  });
  
  return html;
}

// タイムライン表示のレンダリング
function renderTimeline() {
  updateDateDisplay();
  
  const selectedDateStart = new Date(selectedDate);
  selectedDateStart.setHours(0, 0, 0, 0);
  const selectedDateEnd = new Date(selectedDate);
  selectedDateEnd.setHours(23, 59, 59, 999);
  
  // 選択した日のタイムボックスを取得
  const dayTimeboxes = timeboxes.filter(box => {
    return box.timeA >= selectedDateStart && box.timeA <= selectedDateEnd;
  });
  
  updateDailyStats(dayTimeboxes);
  
  if (dayTimeboxes.length === 0) {
    timelineContent.innerHTML = '<div class="timeline-empty">この日の記録はありません</div>';
    return;
  }
  
  // 24時間分のタイムライン構造を生成
  let timelineHTML = '';
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);
  
  for (let hour = 0; hour < 24; hour++) {
    const hourTimeboxes = getHourTimeboxes(dayTimeboxes, hour, selectedDate);
    const isCurrentHour = isToday && now.getHours() === hour;
    const hourClass = isCurrentHour ? 'timeline-hour current-hour' : 'timeline-hour';
    
    timelineHTML += `
      <div class="${hourClass}" data-hour="${hour}">
        <div class="hour-label">${hour.toString().padStart(2, '0')}:00</div>
        <div class="hour-content">
          ${renderHourTimeboxes(hourTimeboxes)}
        </div>
      </div>
    `;
  }
  
  timelineContent.innerHTML = timelineHTML;
  
  // 現在時刻のラインを表示（今日の場合のみ）
  if (isToday) {
    addCurrentTimeLine();
  }
}

// 現在時刻のラインを追加
function addCurrentTimeLine() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  // 現在の時間の要素を取得
  const hourElement = timelineContent.querySelector(`[data-hour="${currentHour}"]`);
  if (hourElement) {
    // 分に基づいて位置を計算
    const topPosition = 8 + (currentMinutes / 60) * 44;
    
    const timeLine = document.createElement('div');
    timeLine.className = 'current-time-line';
    timeLine.style.top = `${topPosition}px`;
    
    hourElement.style.position = 'relative';
    hourElement.appendChild(timeLine);
  }
}

// 日付ナビゲーション
function changeDate(days) {
  selectedDate = new Date(selectedDate);
  selectedDate.setDate(selectedDate.getDate() + days);
  renderTimeline();
}

function goToToday() {
  selectedDate = new Date();
  renderTimeline();
}

// 日付表示の更新
function updateDateDisplay() {
  const today = new Date();
  
  if (isSameDay(selectedDate, today)) {
    currentDateEl.textContent = '今日';
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (isSameDay(selectedDate, yesterday)) {
      currentDateEl.textContent = '昨日';
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (isSameDay(selectedDate, tomorrow)) {
        currentDateEl.textContent = '明日';
      } else {
        currentDateEl.textContent = formatDateShort(selectedDate);
      }
    }
  }
}

// 日別統計の更新
function updateDailyStats(dayTimeboxes) {
  const totalDuration = dayTimeboxes.reduce((sum, box) => sum + box.timeD, 0);
  const totalRecords = dayTimeboxes.length;
  
  totalTimeEl.textContent = formatDurationShort(totalDuration);
  totalRecordsEl.textContent = `${totalRecords}件`;
}

// 全てクリア
function clearAll() {
  if (confirm('すべての記録を削除しますか？')) {
    timeboxes = [];
    localStorage.removeItem('timeboxes');
    localStorage.removeItem('timerState');
    renderCurrentView();
    updateClearButtonVisibility();
  }
}

// クリアボタンの表示/非表示更新
function updateClearButtonVisibility() {
  clearButton.style.display = timeboxes.length > 0 ? 'block' : 'none';
}

// ユーティリティ関数
function formatDate(date) {
  if (!date) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateShort(date) {
  if (!date) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatTime(date) {
  if (!date) return '';
  return date.toTimeString().substr(0, 5);
}

function formatDuration(ms) {
  if (!ms) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

function formatDurationShort(ms) {
  if (!ms) return '0分';
  const totalMinutes = Math.floor(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  } else {
    return `${minutes}分`;
  }
}

function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// PWAインストールガイドの表示
function showInstallGuide() {
  const hasShownInstallGuide = localStorage.getItem('hasShownInstallGuide');
  if (!hasShownInstallGuide && isInstallable()) {
    alert('このアプリはホーム画面に追加できます。ブラウザのメニューから「ホーム画面に追加」を選択してください。');
    localStorage.setItem('hasShownInstallGuide', 'true');
  }
}

// PWAのインストール可能性チェック
function isInstallable() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return isMobile && !isStandalone;
}

// アプリの初期化
document.addEventListener('DOMContentLoaded', () => {
  init();
  showInstallGuide();
  
  // 1分ごとに現在時刻ラインを更新
  setInterval(() => {
    if (currentView === 'timeline' && isSameDay(selectedDate, new Date())) {
      renderTimeline();
    }
  }, 60000);
});
