/***** ✅ 사용자가 직접 수정해야 하는 부분 *****/
// 깃허브 저장소 정보 입력
const GITHUB = {
  owner: "littledoor-ai",        // ✅ 본인 깃허브 ID
  repo: "survey-project",         // ✅ 저장소 이름
  branch: "main",                 // ✅ 브랜치 (보통 main)
  path: "images"                  // ✅ 이미지 폴더 이름
};

// Google Apps Script Web App URL 입력
// ✅ Apps Script 코드를 수정한 후 새 배포 URL을 여기에 붙여넣으세요.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwZneOnZe0ZgqQAZ1Ix19NbQbwHybU4WNbiAd02DGIcThiBaXb4rTRPvZwqcGr7b2RS/exec";

/*****************************************************/

// ===== 설정 상수 =====
const SAMPLE_SIZE = 100;  // 한 번에 평가할 사진 개수
const SCALE_MIN = 1;
const SCALE_MAX = 5;

// 평가 항목 정의 (추후 쉽게 추가/수정 가능하도록 배열로 관리)
const EVALUATION_ITEMS = [
  { id: 'vitality', label: '활력', description: '활기차고 생동감 있는 정도' },
  { id: 'beauty', label: '아름다움', description: '미적으로 아름다운 정도' },
  { id: 'safety', label: '안전', description: '교통사고 위험이 적은 정도' },
  { id: 'walkability', label: '보행친화', description: '보행하기 편한 정도' },
  { id: 'connectivity', label: '연결', description: '다양한 목적지로 잘 연결된 정도' },
  { id: 'complexity', label: '복잡', description: '시각적으로 복잡한 정도' },
  { id: 'greenery', label: '녹지친화', description: '자연과 녹지가 충분한 정도' }
];

// ===== 전역 변수 =====
let currentImage = 0;
let responses = [];
let participant = { gender: "", age: "", occupation: "" };
let selectedImages = [];
const userID = generateUserID();

// 세션 스토리지를 사용하여 진행도 추적
let sessionProgress = {
  totalEvaluated: 0,  // 총 평가한 사진 개수
  startIndex: 0       // 현재 세션의 시작 인덱스
};

/**
 * UUID 생성
 */
function generateUserID() {
  return 'xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 이미지 URL에서 파일명 추출
 */
function getImageID(url) {
  return url.split('/').pop();
}

/**
 * 성별, 나이, 직업군 기반 세션 키 생성
 */
function getSessionKey() {
  return `session_${participant.gender}_${participant.age}_${participant.occupation}`;
}

/**
 * 로컬 스토리지에서 진행도 불러오기
 */
function loadSessionProgress() {
  const key = getSessionKey();
  const saved = localStorage.getItem(key);
  
  if (saved) {
    const progress = JSON.parse(saved);
    sessionProgress.totalEvaluated = progress.totalEvaluated || 0;
    sessionProgress.startIndex = progress.startIndex || 0;
    console.log(`로드된 진행도: ${sessionProgress.startIndex}~${sessionProgress.startIndex + sessionProgress.totalEvaluated - 1}`);
  }
}

/**
 * 로컬 스토리지에 진행도 저장
 */
function saveSessionProgress() {
  const key = getSessionKey();
  localStorage.setItem(key, JSON.stringify(sessionProgress));
  console.log(`저장된 진행도: ${sessionProgress.startIndex}~${sessionProgress.startIndex + sessionProgress.totalEvaluated - 1}`);
}

/**
 * 페이지 전환
 */
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

/**
 * GitHub API를 통해 이미지 목록 불러오기
 */
async function getImageList() {
  try {
    const api = `https://api.github.com/repos/${GITHUB.owner}/${GITHUB.repo}/git/trees/${GITHUB.branch}?recursive=1`;
    const res = await fetch(api);
    
    if (!res.ok) {
      throw new Error(`GitHub API 오류: ${res.status}`);
    }
    
    const data = await res.json();

    if (data.message === 'Not Found') {
      console.error('저장소를 찾을 수 없습니다. GitHub 설정을 확인하세요.');
      alert('이미지를 불러올 수 없습니다. 설정을 확인해 주세요.');
      return [];
    }

    const exts = /\.(jpg|jpeg|png|webp)$/i;
    const images = data.tree
      .filter(item => item.type === "blob" && item.path.startsWith(`${GITHUB.path}/`) && exts.test(item.path))
      .sort()  // 순차적 정렬
      .map(item => `https://raw.githubusercontent.com/${GITHUB.owner}/${GITHUB.repo}/${GITHUB.branch}/${item.path}`);
    
    console.log(`총 ${images.length}개 이미지 로드됨`);
    return images;
  } catch (error) {
    console.error('이미지 목록 불러오기 실패:', error);
    alert('이미지를 불러올 수 없습니다. 인터넷 연결을 확인해 주세요.');
    return [];
  }
}

/**
 * 평가 항목 HTML 생성
 */
function generateEvaluationItems() {
  const container = document.getElementById('evaluation-items');
  container.innerHTML = '';

  EVALUATION_ITEMS.forEach(item => {
    const div = document.createElement('div');
    div.className = 'evaluation-item';

    const label = document.createElement('label');
    label.textContent = `${item.label}`;
    div.appendChild(label);

    const scaleGroup = document.createElement('div');
    scaleGroup.className = 'scale-group';

    for (let i = SCALE_MIN; i <= SCALE_MAX; i++) {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = item.id;
      radio.value = i.toString();
      radio.id = `${item.id}-${i}`;

      const radioLabel = document.createElement('label');
      radioLabel.htmlFor = `${item.id}-${i}`;
      radioLabel.textContent = i.toString();
      radioLabel.style.display = 'flex';
      radioLabel.style.alignItems = 'center';
      radioLabel.style.justifyContent = 'center';

      scaleGroup.appendChild(radio);
      scaleGroup.appendChild(radioLabel);
    }

    div.appendChild(scaleGroup);
    container.appendChild(div);
  });
}

/**
 * 설문 초기화
 */
async function initSurvey() {
  // 진행도 불러오기
  loadSessionProgress();

  const allImages = await getImageList();
  
  if (allImages.length === 0) {
    alert('이미지를 불러올 수 없습니다.');
    showPage('intro-page');
    return;
  }

  // 그룹별 시작 인덱스 설정
  // 다음 세션에서는 이전에 평가한 이미지 다음부터 시작
  const startIdx = sessionProgress.startIndex + sessionProgress.totalEvaluated;
  
  // SAMPLE_SIZE 개 또는 남은 모든 이미지
  const endIdx = Math.min(startIdx + SAMPLE_SIZE, allImages.length);
  const imageCount = endIdx - startIdx;

  if (startIdx >= allImages.length) {
    alert(`모든 이미지(${allImages.length}개)를 완료했습니다!`);
    showPage('intro-page');
    return;
  }

  selectedImages = allImages.slice(startIdx, endIdx);
  currentImage = 0;
  responses = [];

  console.log(`평가 시작: ${startIdx + 1}~${endIdx} (총 ${imageCount}개)`);

  // 평가 항목 생성
  generateEvaluationItems();

  // 첫 번째 이미지 로드
  await loadImage();
}

/**
 * 이미지 로드
 */
async function loadImage() {
  const img = document.getElementById("survey-image");
  const loadingEl = document.getElementById("loading");

  // 로딩 표시
  loadingEl.style.display = "block";
  img.style.display = "none";

  try {
    // 이미지 미리 로드
    const imageUrl = selectedImages[currentImage];
    
    // 이미지 로드 완료 대기
    const loadPromise = new Promise((resolve, reject) => {
      const tempImg = new Image();
      tempImg.onload = resolve;
      tempImg.onerror = reject;
      tempImg.src = imageUrl;
    });

    await loadPromise;

    // DOM 업데이트
    img.src = imageUrl;
    img.style.display = "block";
    loadingEl.style.display = "none";
    updateProgress();
    clearScoreSelection();

  } catch (error) {
    console.error('이미지 로드 실패:', error);
    loadingEl.textContent = "이미지 로딩 실패";
    loadingEl.style.display = "block";
  }
}

/**
 * 진행상황 업데이트
 */
function updateProgress() {
  const totalToEvaluate = selectedImages.length;
  const current = currentImage + 1;
  document.getElementById("progress-text").textContent = 
    `${sessionProgress.startIndex + current} / ${sessionProgress.startIndex + totalToEvaluate} (총 100개)`;
}

/**
 * 점수 선택 초기화
 */
function clearScoreSelection() {
  document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
}

/**
 * 모든 평가 항목이 선택되었는지 확인
 */
function allItemsScored() {
  for (const item of EVALUATION_ITEMS) {
    const checked = document.querySelector(`input[name="${item.id}"]:checked`);
    if (!checked) {
      return false;
    }
  }
  return true;
}

/**
 * 다음 질문
 */
async function nextQuestion() {
  // 모든 항목이 선택되었는지 확인
  if (!allItemsScored()) {
    alert("⚠️ 모든 항목을 평가해주세요!");
    return;
  }

  // 현재 이미지에 대한 응답 수집
  const scores = {};
  EVALUATION_ITEMS.forEach(item => {
    const checked = document.querySelector(`input[name="${item.id}"]:checked`);
    if (checked) {
      scores[item.id] = parseInt(checked.value);
    }
  });

  responses.push({
    timestamp: new Date().toISOString(),
    userID,
    gender: participant.gender,
    age: participant.age,
    occupation: participant.occupation,
    imageID: getImageID(selectedImages[currentImage]),
    scores: scores
  });

  // 다음 이미지로 진행
  if (currentImage >= selectedImages.length - 1) {
    // 현재 배치의 마지막 이미지 - 제출 처리
    await submitSurvey();
    return;
  }

  currentImage++;
  await loadImage();
}

/**
 * 이전 질문
 */
function prevQuestion() {
  if (currentImage > 0) {
    currentImage--;
    responses.pop();
    loadImage();
  }
}

/**
 * 설문 제출 (JSONP 방식)
 */
async function submitSurvey() {
  return new Promise((resolve, reject) => {
    const submitData = {
      participant,
      userID,
      responses,
      evaluationItems: EVALUATION_ITEMS.map(item => ({ id: item.id, label: item.label }))
    };

    console.log("제출할 데이터:", submitData);

    // 콜백 함수 이름 생성
    const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

    // 진행도 업데이트
    sessionProgress.totalEvaluated += responses.length;
    saveSessionProgress();

    // URL 생성
    const url = `${APPS_SCRIPT_URL}?callback=${callbackName}&data=${encodeURIComponent(JSON.stringify(submitData))}`;

    console.log("요청 URL:", url);

    // JSONP 콜백 함수 정의
    window[callbackName] = function(result) {
      console.log("서버 응답:", result);

      // 정리
      if (timeoutId) clearTimeout(timeoutId);
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window[callbackName];

      if (result && result.status === "success") {
        console.log("제출 성공");
        showCompletionPage();
        resolve(result);
      } else {
        console.error("제출 실패:", result);
        alert("제출 중 오류 발생: " + (result ? result.message : "알 수 없는 오류"));
        reject(new Error(result ? result.message : "제출 실패"));
      }
    };

    // Script 태그 생성 및 요청
    const script = document.createElement('script');
    script.src = url;

    script.onerror = function() {
      console.error("JSONP 요청 실패");
      if (timeoutId) clearTimeout(timeoutId);
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window[callbackName];
      alert("네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.");
      reject(new Error("네트워크 오류"));
    };

    // 타임아웃 설정 (30초)
    const timeoutId = setTimeout(() => {
      console.error("제출 타임아웃");
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window[callbackName];
      alert("제출 시간이 초과되었습니다. 다시 시도해 주세요.");
      reject(new Error("타임아웃"));
    }, 30000);

    document.head.appendChild(script);
    console.log("JSONP 요청 시작");
  });
}

/**
 * 완료 페이지 표시
 */
function showCompletionPage() {
  showPage("end-page");
  const infoEl = document.getElementById("completion-info");
  infoEl.textContent = `
    성별: ${participant.gender} | 연령대: ${participant.age} | 직업군: ${participant.occupation}
    평가 완료: ${sessionProgress.startIndex + sessionProgress.totalEvaluated} / 100개
  `;
}

/**
 * 이벤트 바인딩
 */
document.addEventListener("DOMContentLoaded", () => {
  // 설문 시작 버튼
  document.getElementById("startBtn").addEventListener("click", () => {
    const gender = document.querySelector('input[name="gender"]:checked');
    const age = document.getElementById("age").value;
    const occupation = document.getElementById("occupation").value;

    if (!gender || !age || !occupation) {
      alert("⚠️ 성별, 연령대, 직업군을 모두 선택해주세요.");
      return;
    }

    participant.gender = gender.value;
    participant.age = age;
    participant.occupation = occupation;

    showPage("survey-page");
    initSurvey();
  });

  // 다음/이전 버튼
  document.getElementById("nextBtn").addEventListener("click", nextQuestion);
  document.getElementById("prevBtn").addEventListener("click", () => {
    if (currentImage > 0) {
      prevQuestion();
    }
  });

  // 이전 버튼 비활성화 초기값
  document.getElementById("prevBtn").disabled = true;

  // 이미지 변경 시 이전 버튼 상태 업데이트
  const updatePrevButton = () => {
    document.getElementById("prevBtn").disabled = currentImage === 0;
  };
  
  // 이전/다음 버튼 클릭 후 업데이트
  const originalPrevBtn = document.getElementById("prevBtn");
  const originalNextBtn = document.getElementById("nextBtn");
  
  originalNextBtn.addEventListener("click", () => {
    setTimeout(updatePrevButton, 100);
  });
  
  originalPrevBtn.addEventListener("click", () => {
    setTimeout(updatePrevButton, 100);
  });
});
