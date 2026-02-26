const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    reportId: {
        type: String,
        unique: true
    },
    reportedBy: {
        type: String,
        required: true
    },
    name: {         // ไอดีที่โกง / เลขบัญชี
        type: String,
        required: true,
        trim: true
    },
    type: {         // ประเภทการโกง
        type: String,
        required: true,
        enum: ['โกง', 'โดนดึงไอดี', 'ไอดีล็อค-แบน', 'อื่นๆ']
    },
    detail: {       // รายละเอียด
        type: String,
        required: true
    },
    image: {        // หลักฐาน (Base64)
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'รอตรวจสอบ',
        enum: ['รอตรวจสอบ', 'อันตราย', 'คืนเงินแล้ว/อื่นๆ/โปรดระวัง']
    },
    negotiation: {  // การเจรจา/หลักฐานแก้สถานะ
        type: String,
        default: '-'
    }
}, { timestamps: true });

// สร้าง reportId อัตโนมัติก่อนบันทึก
blacklistSchema.pre('save', function (next) {
    if (!this.reportId) {
        this.reportId = 'SCAM-' + Date.now();
    }
    next();
});

module.exports = mongoose.model('Blacklist', blacklistSchema);
