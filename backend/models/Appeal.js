const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
    appealId: {
        type: String,
        unique: true
    },
    submittedBy: {  // ผู้ส่งคำร้อง
        type: String,
        required: true
    },
    targetId: {     // ไอดีที่ต้องการแก้สถานะ
        type: String,
        required: true,
        trim: true
    },
    detail: {       // รายละเอียดการเจรจา
        type: String,
        required: true
    },
    image: {        // หลักฐาน (Base64)
        type: String,
        required: true
    },
    isDone: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

appealSchema.pre('save', function (next) {
    if (!this.appealId) {
        this.appealId = 'APP-' + Date.now();
    }
    next();
});

module.exports = mongoose.model('Appeal', appealSchema);
