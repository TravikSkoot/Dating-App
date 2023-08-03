const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/user');  // Pfad zu Ihrem User-Modell
const jwt = require('jsonwebtoken');

const app = express();

mongoose.connect('mongodb+srv://TravikSkoot:SK914010ok.@cluster0.rxducmd.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('Failed to connect to MongoDB', err));

app.use(express.json());  // Damit Express JSON-Body-Parsing unterstützt

//Registrierung
app.post('/users/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    let user = await User.findOne({ email });
    if (user) return res.status(400).send('User already exists');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    user = new User({ username, email, password: hashedPassword });
    await user.save();
    
    res.status(201).send('User registered successfully');
});

//Login
app.post('/users/login', async (req, res) => {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).send('Invalid email or password');
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).send('Invalid email or password');
    
    const token = jwt.sign({ _id: user._id }, 'your_jwt_secret');
    res.header('auth-token', token).send(token);
});

//Profil Updaten
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

app.get('/users/profile/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).send('User not found');

    res.send(user);
});

app.get('/users/search/:interest', auth, async (req, res) => {
    const interest = req.params.interest;

    const users = await User.find({ interests: interest });
    if (users.length === 0) return res.status(404).send('No users found with that interest');

    res.send(users);
});

//Likes senden
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

//Likes abrufen
app.get('/users/likes/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).send('User not found');

    const likes = await User.find({ _id: { $in: user.likes } });

    res.send(likes);
});

//Matches anzeigen
app.get('/users/matches/:username', auth, async (req, res) => {
    const username = req.params.username;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).send('User not found');

    // Finden Sie alle Benutzer, die der aktuelle Benutzer geliked hat
    const likedUsers = await User.find({ _id: { $in: user.likes } });

    // Filtern Sie diese Liste, um nur die Benutzer zu behalten, die den aktuellen Benutzer auch geliked haben
    const matches = likedUsers.filter(likedUser => likedUser.likes.includes(user._id.toString()));

    res.send(matches);
});

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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));