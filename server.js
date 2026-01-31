const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/familysite', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 사용자 스키마
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  familyCode: { type: String, required: true },
  role: { type: String, default: 'member' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 채팅 메시지 스키마
const messageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  room: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// JWT 인증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// 회원가입
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, familyCode } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      familyCode
    });
    
    await user.save();
    res.status(201).json({ message: '회원가입이 완료되었습니다.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 로그인
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: '비밀번호가 올바르지 않습니다.' });
    }
    
    const token = jwt.sign(
      { userId: user._id, username: user.username, familyCode: user.familyCode },
      process.env.JWT_SECRET || 'your-secret-key'
    );
    
    res.json({ token, username: user.username, familyCode: user.familyCode });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 채팅 메시지 가져오기
app.get('/api/messages/:room', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.room })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('사용자가 연결되었습니다:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`사용자가 ${room} 방에 입장했습니다.`);
  });

  socket.on('chat-message', async (data) => {
    try {
      const message = new Message({
        username: data.username,
        message: data.message,
        room: data.room
      });
      
      await message.save();
      io.to(data.room).emit('chat-message', {
        username: data.username,
        message: data.message,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('메시지 저장 오류:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('사용자가 연결을 끊었습니다:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});