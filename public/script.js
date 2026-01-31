// 전역 변수
let socket;
let currentUser = null;
let currentRoom = 'family';
let token = localStorage.getItem('token');

// DOM 요소들
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeMessage = document.getElementById('welcomeMessage');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        // 토큰이 있으면 자동 로그인 시도
        const userData = parseJWT(token);
        if (userData) {
            currentUser = userData;
            showMainApp();
        } else {
            showAuthScreen();
        }
    } else {
        showAuthScreen();
    }
    
    setupEventListeners();
});

// JWT 파싱 함수
function parseJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        return null;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 인증 관련
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });
    
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });
    
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutBtn.addEventListener('click', handleLogout);
    
    // 네비게이션
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });
    
    // 채팅방 버튼
    document.querySelectorAll('.room-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const room = e.target.dataset.room;
            switchRoom(room);
        });
    });
    
    // 채팅 메시지 전송
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // 게임 버튼
    document.querySelectorAll('.play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gameType = e.target.closest('.game-card').dataset.game;
            startGame(gameType);
        });
    });
    
    // 모달 닫기
    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('gameModal').classList.add('hidden');
    });
    
    // 달력 관련
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    document.getElementById('addEventBtn').addEventListener('click', addEvent);
}

// 로그인 처리
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            currentUser = parseJWT(token);
            showMainApp();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('로그인 중 오류가 발생했습니다.');
    }
}

// 회원가입 처리
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const familyCode = document.getElementById('familyCode').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password, familyCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('회원가입이 완료되었습니다. 로그인해주세요.');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('회원가입 중 오류가 발생했습니다.');
    }
}

// 로그아웃 처리
function handleLogout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    showAuthScreen();
}

// 인증 화면 표시
function showAuthScreen() {
    authContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
}

// 메인 앱 표시
function showMainApp() {
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    welcomeMessage.textContent = `안녕하세요, ${currentUser.username}님!`;
    
    // Socket.IO 연결
    initializeSocket();
    
    // 기본 섹션 표시
    showSection('chat');
    
    // 달력 초기화
    initializeCalendar();
}

// Socket.IO 초기화
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('서버에 연결되었습니다.');
        socket.emit('join-room', currentUser.familyCode + '-' + currentRoom);
    });
    
    socket.on('chat-message', (data) => {
        displayMessage(data);
    });
    
    // 기존 메시지 로드
    loadMessages(currentRoom);
}

// 섹션 표시
function showSection(sectionName) {
    // 모든 섹션 숨기기
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 모든 네비게이션 버튼 비활성화
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 선택된 섹션과 버튼 활성화
    document.getElementById(`${sectionName}-section`).classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
}

// 채팅방 전환
function switchRoom(room) {
    currentRoom = room;
    
    // 모든 방 버튼 비활성화
    document.querySelectorAll('.room-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 선택된 방 버튼 활성화
    document.querySelector(`[data-room="${room}"]`).classList.add('active');
    
    // 새 방에 입장
    socket.emit('join-room', currentUser.familyCode + '-' + room);
    
    // 메시지 로드
    loadMessages(room);
}

// 메시지 로드
async function loadMessages(room) {
    try {
        const response = await fetch(`/api/messages/${currentUser.familyCode}-${room}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            
            messages.forEach(message => {
                displayMessage({
                    username: message.username,
                    message: message.message,
                    timestamp: new Date(message.timestamp)
                });
            });
        }
    } catch (error) {
        console.error('메시지 로드 오류:', error);
    }
}

// 메시지 전송
function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message && socket) {
        socket.emit('chat-message', {
            username: currentUser.username,
            message: message,
            room: currentUser.familyCode + '-' + currentRoom
        });
        
        messageInput.value = '';
    }
}

// 메시지 표시
function displayMessage(data) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const timestamp = new Date(data.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <span class="username">${data.username}:</span>
        <span class="content">${data.message}</span>
        <span class="timestamp">${timestamp}</span>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 게임 시작
function startGame(gameType) {
    const modal = document.getElementById('gameModal');
    const gameContent = document.getElementById('gameContent');
    
    switch (gameType) {
        case 'quiz':
            gameContent.innerHTML = createQuizGame();
            break;
        case 'memory':
            gameContent.innerHTML = createMemoryGame();
            break;
        case 'drawing':
            gameContent.innerHTML = createDrawingGame();
            break;
    }
    
    modal.classList.remove('hidden');
}

// 퀴즈 게임 생성
function createQuizGame() {
    const questions = [
        { question: "우리 가족의 막내는 누구인가요?", options: ["엄마", "아빠", "형/언니", "나"], correct: 3 },
        { question: "가족 여행으로 가고 싶은 곳은?", options: ["바다", "산", "도시", "시골"], correct: 0 },
        { question: "가족의 취미는 무엇인가요?", options: ["영화보기", "요리하기", "운동하기", "독서하기"], correct: 1 }
    ];
    
    let currentQuestion = 0;
    let score = 0;
    
    function renderQuestion() {
        const q = questions[currentQuestion];
        return `
            <h3>🧠 가족 퀴즈</h3>
            <div class="quiz-container">
                <p><strong>문제 ${currentQuestion + 1}:</strong> ${q.question}</p>
                <div class="quiz-options">
                    ${q.options.map((option, index) => 
                        `<button class="quiz-option" onclick="selectAnswer(${index})">${option}</button>`
                    ).join('')}
                </div>
                <p>점수: ${score}/${questions.length}</p>
            </div>
        `;
    }
    
    window.selectAnswer = function(selected) {
        if (selected === questions[currentQuestion].correct) {
            score++;
            alert('정답입니다! 🎉');
        } else {
            alert('틀렸습니다. 😅');
        }
        
        currentQuestion++;
        if (currentQuestion < questions.length) {
            document.getElementById('gameContent').innerHTML = renderQuestion();
        } else {
            document.getElementById('gameContent').innerHTML = `
                <h3>🧠 퀴즈 완료!</h3>
                <p>최종 점수: ${score}/${questions.length}</p>
                <button onclick="document.getElementById('gameModal').classList.add('hidden')">닫기</button>
            `;
        }
    };
    
    return renderQuestion();
}

// 기억력 게임 생성
function createMemoryGame() {
    const cards = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];
    const gameCards = [...cards, ...cards].sort(() => Math.random() - 0.5);
    let flippedCards = [];
    let matchedPairs = 0;
    
    window.flipCard = function(index) {
        const card = document.querySelector(`[data-index="${index}"]`);
        if (card.classList.contains('flipped') || flippedCards.length === 2) return;
        
        card.classList.add('flipped');
        card.textContent = gameCards[index];
        flippedCards.push(index);
        
        if (flippedCards.length === 2) {
            setTimeout(() => {
                if (gameCards[flippedCards[0]] === gameCards[flippedCards[1]]) {
                    matchedPairs++;
                    if (matchedPairs === cards.length) {
                        alert('축하합니다! 모든 카드를 맞췄습니다! 🎉');
                    }
                } else {
                    flippedCards.forEach(i => {
                        const card = document.querySelector(`[data-index="${i}"]`);
                        card.classList.remove('flipped');
                        card.textContent = '?';
                    });
                }
                flippedCards = [];
            }, 1000);
        }
    };
    
    return `
        <h3>🃏 기억력 게임</h3>
        <div class="memory-game">
            ${gameCards.map((_, index) => 
                `<div class="memory-card" data-index="${index}" onclick="flipCard(${index})">?</div>`
            ).join('')}
        </div>
        <style>
            .memory-game {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                max-width: 400px;
                margin: 20px auto;
            }
            .memory-card {
                width: 80px;
                height: 80px;
                background: #667eea;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s;
            }
            .memory-card:hover {
                background: #5a6fd8;
            }
            .memory-card.flipped {
                background: white;
                color: #333;
                border: 2px solid #667eea;
            }
        </style>
    `;
}

// 그림 그리기 게임 생성
function createDrawingGame() {
    return `
        <h3>🎨 그림 맞추기</h3>
        <div class="drawing-game">
            <canvas id="drawingCanvas" width="400" height="300" style="border: 2px solid #667eea; border-radius: 8px;"></canvas>
            <div class="drawing-controls">
                <button onclick="clearCanvas()">지우기</button>
                <button onclick="saveDrawing()">저장</button>
                <input type="color" id="colorPicker" value="#000000">
                <input type="range" id="brushSize" min="1" max="20" value="5">
            </div>
            <p>그림을 그리고 다른 가족들이 맞춰보세요!</p>
        </div>
        <script>
            const canvas = document.getElementById('drawingCanvas');
            const ctx = canvas.getContext('2d');
            let isDrawing = false;
            
            canvas.addEventListener('mousedown', startDrawing);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDrawing);
            
            function startDrawing(e) {
                isDrawing = true;
                draw(e);
            }
            
            function draw(e) {
                if (!isDrawing) return;
                
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                ctx.lineWidth = document.getElementById('brushSize').value;
                ctx.lineCap = 'round';
                ctx.strokeStyle = document.getElementById('colorPicker').value;
                
                ctx.lineTo(x, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y);
            }
            
            function stopDrawing() {
                if (!isDrawing) return;
                isDrawing = false;
                ctx.beginPath();
            }
            
            window.clearCanvas = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            };
            
            window.saveDrawing = function() {
                const dataURL = canvas.toDataURL();
                alert('그림이 저장되었습니다! (실제로는 서버에 저장하는 기능을 구현해야 합니다)');
            };
        </script>
    `;
}

// 달력 초기화
function initializeCalendar() {
    const now = new Date();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();
    renderCalendar();
}

let currentMonth, currentYear;

// 달력 렌더링
function renderCalendar() {
    const monthNames = [
        '1월', '2월', '3월', '4월', '5월', '6월',
        '7월', '8월', '9월', '10월', '11월', '12월'
    ];
    
    document.getElementById('currentMonth').textContent = 
        `${currentYear}년 ${monthNames[currentMonth]}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // 요일 헤더
    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.textContent = day;
        dayHeader.style.fontWeight = 'bold';
        dayHeader.style.textAlign = 'center';
        dayHeader.style.padding = '10px';
        dayHeader.style.background = '#667eea';
        dayHeader.style.color = 'white';
        calendar.appendChild(dayHeader);
    });
    
    // 빈 칸 추가
    for (let i = 0; i < firstDay; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }
    
    // 날짜 추가
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        if (currentYear === today.getFullYear() && 
            currentMonth === today.getMonth() && 
            day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        calendar.appendChild(dayElement);
    }
}

// 월 변경
function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

// 일정 추가
function addEvent() {
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    
    if (title && date) {
        alert(`일정이 추가되었습니다: ${title} (${date})`);
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventDate').value = '';
        // 실제로는 서버에 저장하는 로직이 필요합니다
    } else {
        alert('제목과 날짜를 모두 입력해주세요.');
    }
}