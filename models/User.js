const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    realname: {
        type: String,
        required: false
    },
    age: {
        type: Number,
        required: false
    },
    gender: {
        type: String,
        required: false
    },
    interests: {
        type: [String],
        required: false
    },
    bio: {
        type: String,
        required: false
    },
    matchPreferences: {
        type: Object,
        required: false
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;