const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
});

module.exports = mongoose.model('Chat', ChatSchema);
