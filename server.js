const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Message = require('./models/message');
const Chat = require('./models/chat');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const app = express();
const Report = require('./models/report');
const Block = require('./models/block');
const ProfilePicture = require('./models/profilePictures');


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));

mongoose.connect('mongodb+srv://TravikSkoot:SK914010ok.@cluster0.rxducmd.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('Failed to connect to MongoDB', err));

app.use(express.json());  // Damit Express JSON-Body-Parsing unterstützt

const upload = multer({
    limits: {
      fileSize: 10000000, // limit to 10MB
    },
    fileFilter(req, file, cb) {
      if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
        cb(new Error('Please upload an image file (jpg, jpeg or png)'));
      }
      cb(null, true);
    },
  });

// Authentifizierung
function auth(req, res, next) {
    const token = req.header('auth-token');
    if (!token) return res.status(401).send('Access denied');

    try {
        const verified = jwt.verify(token, 'your_jwt_secret');
        req.user = verified;
        
        next();
    } catch (err) {
        res.status(400).send('Invalid token');
    }
}
// Registrierung
app.post('/users/register', async (req, res) => {
    const { userId, email, password } = req.body;
    
    let user = await User.findOne({ email });
    if (user) return res.status(400).send('User already exists');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    user = new User({ userId, email, password: hashedPassword });
    await user.save();
    
    res.status(201).send('User registered successfully');
});

// Login
app.post('/users/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('Invalid email or password');
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send('Invalid email or password');
    
    const token = jwt.sign({ _id: user._id }, 'your_jwt_secret');
    res.header('auth-token', token).send(token);
});

// Profil aktualisieren
app.put('/users/profile', auth, async (req, res) => {
    const { email, realname, age, gender, interests, bio, matchPreferences } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    user.realname = realname;
    user.age = age;
    user.gender = gender;
    user.interests = interests;
    user.bio = bio;
    user.matchPreferences = matchPreferences;

    await user.save();

    res.send('Profile updated successfully');
});

// Profil anzeigen
app.get('/users/profile/:userId', auth, async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).send('User not found');

    res.send(user);
});

// Erweiterte Suche
app.get('/users/search', async (req, res) => {
    const { interest, age, gender } = req.query;

    const query = {};
    
    if (interest) query.interests = interest;
    if (age) query.age = { $gte: age.min, $lte: age.max };
    if (gender) query.gender = { $in: gender.split(',') };
    
    const users = await User.find(query);
    
    if (users.length === 0) return res.status(404).send('No users found with that criteria');

    res.send(users);
});

// Likes senden
app.put('/users/like/:userId', auth, async (req, res) => {
    const userId = req.params.userId;
    const likeduserId = req.body.likeduserId;

    const user = await User.findOne({ userId });
    const likedUser = await User.findOne({ userId: likeduserId });

    if (!user || !likedUser) return res.status(404).send('User not found');

    if (user.likes.includes(likedUser._id)) {
        return res.status(400).send('You have already liked this user');
    }

    if (likedUser._id.toString() === user._id.toString()) {
        return res.status(400).send('You cannot like yourself');
    }    

    user.likes.push(likedUser._id);
    await user.save();

    res.send(user);
});

// Likes abrufen
app.get('/users/likes/:userId', auth, async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).send('User not found');

    const likes = await User.find({ _id: { $in: user.likes } });

    res.send(likes);
});

// Matches anzeigen
app.get('/users/matches/:userId', auth, async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).send('User not found');

    const likedUsers = await User.find({ _id: { $in: user.likes } });

    const matches = likedUsers.filter(likedUser => likedUser.likes.includes(user._id.toString()));

    res.send(matches);
});

// Starte einen Chat mit einem anderen Benutzer
app.post('/chats/start', auth, async (req, res) => {
    const userId = req.user._id;
    const partnerId = req.body.partnerId;

    // Überprüfen Sie, ob bereits ein Chat zwischen diesen beiden Benutzern existiert
    let chat = await Chat.findOne({ users: { $all: [userId, partnerId] } });

    if (!chat) {
        chat = new Chat({ users: [userId, partnerId] });
        await chat.save();
    }

    res.send(chat);
});


// Sende eine Nachricht in einem Chat
app.post('/chats/:chatId/messages', auth, async (req, res) => {
    const chatId = req.params.chatId;
    const { text } = req.body;

    const message = new Message({
        sender: req.user._id,
        receiver: req.body.receiverId,  // Sie müssen die receiverId im Anfragekörper senden
        text: text,
        timestamp: new Date()
    });

    await message.save();

    const chat = await Chat.findById(chatId);
    chat.messages.push(message._id);
    chat.lastMessage = message._id;

    await chat.save();

    res.send(message);
});

// Abrufen von Chat-Nachrichten
app.get('/chats/:chatId/messages', auth, async (req, res) => {
    const chatId = req.params.chatId;

    const chat = await Chat.findById(chatId).populate('messages');

    if (!chat) return res.status(404).send('Chat not found');

    res.send(chat.messages);
});


// Bild Upload
app.post('/users/uploadimage', auth, upload.single('image'), async (req, res) => {
    console.log("Request ---", req.body);
    console.log("Request file ---", req.file); // Multer speichert das Bild im Speicher und nicht auf dem Dateisystem

    const user = await User.findOne({ _id: req.user._id });
    if (!user) return res.status(404).send('User not found');

    let profilePic = await ProfilePicture.findOne({ userId: user.userId }); // Suche nach userId

    if (!profilePic) {
        profilePic = new ProfilePicture({
            userId: user.userId, // Setze userId
            data: req.file.buffer,
            contentType: req.file.mimetype
        });
    } else {
        profilePic.profileImage.data = req.file.buffer;
        profilePic.profileImage.contentType = req.file.mimetype;
    }
    console.log(profilePic);        // Loggen Sie das gesamte Profilbild-Objekt
    console.log(profilePic.data);   // Loggen Sie nur den Buffer des Bildes
    await profilePic.save();
    res.status(200).send('Image uploaded successfully');
});

// Bild anzeigen
app.get('/users/profileimage/:userId', auth, async (req, res) => {
    const profilePic = await ProfilePicture.findOne({ userId: req.params.userId }); // Suche nach userId
    
    if (!profilePic) return res.status(404).send('Image not found');

    console.log(profilePic);        // Loggen Sie das gesamte Profilbild-Objekt
    console.log(profilePic.data);   // Loggen Sie nur den Buffer des Bildes

    res.set('Content-Type', profilePic.profileImage.contentType);
    res.send(profilePic.profileImage.data);
});

// Report Funktion
app.post('/users/report/:userId', auth, async (req, res) => {
    const userId = req.params.userId;
    const { reason, additionalComment } = req.body;

    const reporter = await User.findOne({ _id: req.user._id });
    const reportedUser = await User.findOne({ userId });

    if (!reporter || !reportedUser) return res.status(404).send('User not found');

    // Überprüfen Sie, ob der Benutzer sich bereits gemeldet hat
    const existingReport = await Report.findOne({ reporter: reporter._id, reportedUser: reportedUser._id });
    if (existingReport) return res.status(400).send('You have already reported this user');

    const report = new Report({
        reporter: reporter._id,
        reportedUser: reportedUser._id,
        reason,
        additionalComment
    });

    await report.save();

    res.status(201).send('User reported successfully');
});

// Benutzer blockieren
app.post('/users/block/:userId', auth, async (req, res) => {
    const userId = req.params.userId;

    const user = await User.findOne({ _id: req.user._id  });
    const blockedUser = await User.findOne({ userId: req.body.blockeduserId });

    if (!user || !blockedUser) return res.status(404).send('User not found');

    // Überprüfen, ob der Benutzer bereits blockiert wurde
    const block = await Block.findOne({ blocker: user._id, blockedUser: blockedUser._id });
    if (block) return res.status(400).send('You have already blocked this user');

    // Erstellen Sie ein neues Block-Objekt und speichern Sie es
    const newBlock = new Block({ blocker: user._id, blockedUser: blockedUser._id });
    await newBlock.save();

    res.send('User blocked successfully');
});

// Blockierung aufheben
app.delete('/users/unblock', auth, async (req, res) => {
    const { blockeduserId } = req.body;

    const user = await User.findOne({ _id: req.user._id });
    const blockedUser = await User.findOne({ userId: blockeduserId });

    if (!user || !blockedUser) return res.status(404).send('User not found');

    const block = await Block.findOne({ blocker: user._id, blockedUser: blockedUser._id });
    if (!block) return res.status(400).send('User is not blocked');

    await Block.findByIdAndRemove(block._id);

    res.send('User unblocked successfully');
});