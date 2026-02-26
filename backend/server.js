require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const blacklistRoutes = require('./routes/blacklist');
const appealRoutes = require('./routes/appeal');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// เสิร์ฟไฟล์ static (frontend)
app.use(express.static(path.join(__dirname, '..')));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/appeal', appealRoutes);

// Health Check
app.get('/api', (req, res) => {
    res.json({ message: '🚀 Blacklist valorant API is running!', status: 'ok' });
});

// --- Connect MongoDB & Start Server ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB เชื่อมต่อสำเร็จที่:', process.env.MONGO_URI);
        app.listen(PORT, '0.0.0.0', () => {
            const { networkInterfaces } = require('os');
            const nets = networkInterfaces();
            let localIP = 'localhost';
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        localIP = net.address;
                    }
                }
            }
            console.log(`🚀 Server รันอยู่ที่: http://localhost:${PORT}`);
            console.log(`📱 มือถือในวง WiFi เดียวกันเปิดได้ที่: http://${localIP}:${PORT}`);
            console.log(`🌐 แชร์ลิ้งค์นี้: http://${localIP}:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB เชื่อมต่อไม่สำเร็จ:', err.message);
        process.exit(1);
    });
