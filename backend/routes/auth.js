const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// --- Middleware ตรวจสอบ JWT ---
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'ไม่มี Token กรุณาล็อกอินก่อน' });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
};

// POST /api/auth/register - สมัครสมาชิก
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

        const exists = await User.findOne({ $or: [{ username }, { email }] });
        if (exists) return res.status(409).json({ message: 'Username หรือ Email นี้มีในระบบแล้ว' });

        const user = new User({ username, email, password });
        await user.save();
        res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ! กรุณาล็อกอิน' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// POST /api/auth/login - ล็อกอิน
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ message: 'กรุณากรอก username และ password' });

        // ตรวจสอบ Admin จาก ENV
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            const token = jwt.sign({ username: 'Admin', isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, username: 'Admin Dev', isAdmin: true });
        }

        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password)))
            return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

        const token = jwt.sign({ id: user._id, username: user.username, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username, isAdmin: user.isAdmin });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/auth/me - ดึงข้อมูล user ปัจจุบัน
router.get('/me', authMiddleware, async (req, res) => {
    try {
        if (req.user.isAdmin) return res.json({ username: 'Admin Dev', isAdmin: true });
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
