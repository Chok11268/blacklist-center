const express = require('express');
const router = express.Router();
const Appeal = require('../models/Appeal');
const Blacklist = require('../models/Blacklist');
const { authMiddleware } = require('./auth');

// Middleware ตรวจสอบ Admin
const adminMiddleware = (req, res, next) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'เฉพาะแอดมินเท่านั้น' });
    next();
};

// GET /api/appeal/pending - รายการคำร้องรอพิจารณา (Admin only)
router.get('/pending', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const list = await Appeal.find({ isDone: false }).sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/appeal/count - จำนวนคำร้องรอ (Admin only)
router.get('/count', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const count = await Appeal.countDocuments({ isDone: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// POST /api/appeal - ส่งคำร้องใหม่ (ต้อง login)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { targetId, detail, image } = req.body;
        if (!targetId || !detail || !image)
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

        const newAppeal = new Appeal({
            submittedBy: req.user.username,
            targetId,
            detail,
            image
        });
        await newAppeal.save();
        res.status(201).json({ message: '🛠️ ยื่นคำร้องสำเร็จ! แอดมินจะตรวจสอบการเจรจาครับ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// PATCH /api/appeal/:id/approve - อนุมัติคำร้อง (Admin only)
router.patch('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const appeal = await Appeal.findById(req.params.id);
        if (!appeal) return res.status(404).json({ message: 'ไม่พบคำร้อง' });

        // อัปเดตสถานะใน Blacklist
        const blacklistItem = await Blacklist.findOne({ name: appeal.targetId });
        if (blacklistItem) {
            blacklistItem.status = 'คืนเงินแล้ว/อื่นๆ/โปรดระวัง';
            blacklistItem.negotiation = appeal.detail;
            await blacklistItem.save();
        }

        // ปิดคำร้อง
        appeal.isDone = true;
        await appeal.save();

        res.json({ message: '✅ เปลี่ยนสถานะเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

module.exports = router;
