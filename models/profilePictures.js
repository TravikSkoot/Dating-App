const mongoose = require('mongoose');

const profilePictureSchema = new mongoose.Schema({
    username: {
        type: String,
        ref: 'User',  // Dies verknüpft es mit dem User-Modell
        unique: true  // Stellt sicher, dass jeder Benutzer nur ein Profilbild hat
    },
    profileImage: {
        data: Buffer,
        contentType: String
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

const ProfilePicture = mongoose.model('ProfilePicture', profilePictureSchema);

module.exports = ProfilePicture;