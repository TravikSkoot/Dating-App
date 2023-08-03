const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
    blocker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    blockedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Block', blockSchema);