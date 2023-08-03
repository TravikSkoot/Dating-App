const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/user');
const Message = require('./models/message');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const app = express();
const Report = require('./models/report');
const Block = require('./models/block');


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));

mongoose.connect('mongodb+srv://TravikSkoot:SK914010ok.@cluster0.rxducmd.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('Failed to connect to MongoDB', err));

app.use(express.json());  // Damit Express JSON-Body-Parsing unterstützt

const upload = multer({
    limits: {
      fileSize: 10000000, // limit to 1MB
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
    const { username, email, password } = req.body;
    
    let user = await User.findOne({ email });
    if (user) return res.status(400).send('User already exists');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    user = new User({ username, email, password: hashedPassword });
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
app.get('/users/profile/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
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
app.put('/users/like/:username', auth, async (req, res) => {
    const username = req.params.username;
    const likedUsername = req.body.likedUsername;

    const user = await User.findOne({ username });
    const likedUser = await User.findOne({ username: likedUsername });

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
app.get('/users/likes/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).send('User not found');

    const likes = await User.find({ _id: { $in: user.likes } });

    res.send(likes);
});

// Matches anzeigen
app.get('/users/matches/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).send('User not found');

    const likedUsers = await User.find({ _id: { $in: user.likes } });

    const matches = likedUsers.filter(likedUser => likedUser.likes.includes(user._id.toString()));

    res.send(matches);
});

// Nachrichten senden
app.post('/messages', auth, async (req, res) => {
    const { receiver, text } = req.body;

    // Überprüfen Sie, ob der Benutzer versucht, eine Nachricht an sich selbst zu senden
    if (req.user._id === receiver) {
        return res.status(400).send('Cannot send a message to yourself');
    }
    
    const message = new Message({
        sender: req.user._id,
        receiver,
        text
    });

    await message.save();

    res.status(201).send('Message sent');
});


// Nachricht abrufen
app.get('/messages', auth, async (req, res) => {
    const messages = await Message.find({ receiver: req.user._id }).populate('sender');

    res.send(messages);
});

// Bild Upload
app.post('/users/uploadimage', auth, upload.single('image'), async (req, res) => {
    console.log("Request ---", req.body);
    console.log("Request file ---", req.file); // Multer speichert das Bild im Speicher und nicht auf dem Dateisystem

    const user = await User.findOne({ _id: req.user._id });
    if (!user) return res.status(404).send('User not found');
    
    user.profileImage = {
        data: req.file.buffer,
        contentType: req.file.mimetype
    };
    await user.save();

    return res.send(200).end();
});

// Bild anzeigen
app.get('/users/profileimage/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
    if (!user || !user.profileImage) return res.status(404).send('User or image not found');

    res.set('Content-Type', user.profileImage.contentType);
    res.send(user.profileImage.data);
});

// Report Funktion
app.post('/users/report/:username', auth, async (req, res) => {
    const username = req.params.username;
    const { reason, additionalComment } = req.body;

    const reporter = await User.findOne({ _id: req.user._id });
    const reportedUser = await User.findOne({ username });

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
app.post('/users/block/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ _id: req.user._id  });
    const blockedUser = await User.findOne({ username: req.body.blockedUsername });

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
    const { blockedUsername } = req.body;

    const user = await User.findOne({ _id: req.user._id });
    const blockedUser = await User.findOne({ username: blockedUsername });

    if (!user || !blockedUser) return res.status(404).send('User not found');

    const block = await Block.findOne({ blocker: user._id, blockedUser: blockedUser._id });
    if (!block) return res.status(400).send('User is not blocked');

    await Block.findByIdAndRemove(block._id);

    res.send('User unblocked successfully');
});