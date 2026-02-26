const express = require('express');
const router = express.Router();
const Blacklist = require('../models/Blacklist');
const { authMiddleware } = require('./auth');

// Middleware ตรวจสอบ Admin
const adminMiddleware = (req, res, next) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: 'เฉพาะแอดมินเท่านั้น' });
    next();
};

// GET /api/blacklist - ดึงรายการทั้งหมด (สาธารณะ - เฉพาะที่อนุมัติแล้ว)
router.get('/', async (req, res) => {
    try {
        const list = await Blacklist.find({ status: { $ne: 'รอตรวจสอบ' } })
            .sort({ createdAt: -1 })
            .select('-image'); // ไม่ส่ง image ใน list view เพื่อประหยัด bandwidth
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/blacklist/all - ดึงรายการทั้งหมด (Admin only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const list = await Blacklist.find().sort({ createdAt: -1 }).select('-image');
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/blacklist/pending - รายการรอตรวจสอบ (Admin only)
router.get('/pending', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const list = await Blacklist.find({ status: 'รอตรวจสอบ' }).sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/blacklist/search?q=... - ค้นหา (สาธารณะ)
router.get('/search', async (req, res) => {
    try {
        const q = req.query.q?.trim();
        if (!q) return res.status(400).json({ message: 'กรุณาระบุคำค้นหา' });

        const results = await Blacklist.find({
            name: { $regex: q, $options: 'i' },
            status: { $ne: 'รอตรวจสอบ' }
        }).sort({ createdAt: -1 });

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/blacklist/stats - สถิติ (Admin only)
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const pending = await Blacklist.countDocuments({ status: 'รอตรวจสอบ' });
        const danger = await Blacklist.countDocuments({ status: 'อันตราย' });
        const resolved = await Blacklist.countDocuments({ status: 'คืนเงินแล้ว/อื่นๆ/โปรดระวัง' });
        res.json({ pending, danger, resolved, total: pending + danger + resolved });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// POST /api/blacklist - แจ้งโกงใหม่ (ต้อง login)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, type, detail, image } = req.body;
        if (!name || !type || !detail || !image)
            return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

        const newCase = new Blacklist({
            reportedBy: req.user.username,
            name,
            type,
            detail,
            image
        });
        await newCase.save();
        res.status(201).json({ message: '📢 บันทึกสำเร็จ! สถานะคือ รอตรวจสอบ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// PATCH /api/blacklist/:id/approve - อนุมัติ (Admin only)
router.patch('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const item = await Blacklist.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        item.status = 'อันตราย';
        await item.save();
        res.json({ message: '✅ อนุมัติสถานะเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// PATCH /api/blacklist/:id/status - อัปเดตสถานะ (Admin only)
router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { status, negotiation } = req.body;
        const item = await Blacklist.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        if (status) item.status = status;
        if (negotiation) item.negotiation = negotiation;
        await item.save();
        res.json({ message: '✅ อัปเดตสถานะเรียบร้อย' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// GET /api/blacklist/:id/image - ดึงรูปของรายการ (สาธารณะ)
router.get('/:id/image', async (req, res) => {
    try {
        const item = await Blacklist.findById(req.params.id).select('image status');
        if (!item) return res.status(404).json({ message: 'ไม่พบข้อมูล' });
        if (item.status === 'รอตรวจสอบ') return res.status(403).json({ message: 'รูปภาพนี้ยังรอตรวจสอบ' });
        res.json({ image: item.image });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

// DELETE /api/blacklist/:id - ลบ (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await Blacklist.findByIdAndDelete(req.params.id);
        res.json({ message: '🗑️ ลบข้อมูลสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'เกิดข้อผิดพลาด', error: err.message });
    }
});

module.exports = router;
