const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URL || 'mongodb://mongo:27017/appdb');

const User = mongoose.model('User', { username: String, password: String });
const Message = mongoose.model('Message', { from: String, to: String, message: String, createdAt: { type: Date, default: Date.now } });
const Todo = mongoose.model('Todo', { userId: String, task: String, done: Boolean });
const Quote = mongoose.model('Quote', { userId: String, username: String, quote: String, createdAt: { type: Date, default: Date.now } });

const auth = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({error: 'Unauthorized'});
  const user = await User.findById(token);
  if (!user) return res.status(401).json({error: 'Unauthorized'});
  req.userId = token;
  req.username = user.username;
  next();
};

app.post('/api/register', async (req, res) => {
  const {username, password} = req.body;
  const existing = await User.findOne({username});
  if (existing) return res.status(400).json({error: 'Username already exists'});
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const user = new User({username, password: hash});
  await user.save();
  res.json({success: true});
});

app.post('/api/login', async (req, res) => {
  const {username, password} = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const user = await User.findOne({username, password: hash});
  if (!user) return res.status(401).json({error: 'Invalid credentials'});
  res.json({token: user._id.toString(), username: user.username});
});

app.get('/api/me', auth, (req, res) => {
  res.json({username: req.username});
});

app.get('/api/users', auth, async (req, res) => {
  const users = await User.find({_id: {$ne: req.userId}}, 'username');
  res.json(users);
});

app.get('/api/messages/:user', auth, async (req, res) => {
  const messages = await Message.find({$or: [{from: req.username, to: req.params.user}, {from: req.params.user, to: req.username}]}).sort({createdAt: 1});
  res.json(messages);
});

app.post('/api/messages', auth, async (req, res) => {
  const message = new Message({from: req.username, to: req.body.to, message: req.body.message});
  await message.save();
  res.json(message);
});

app.get('/api/todos', auth, async (req, res) => {
  const todos = await Todo.find({userId: req.userId});
  res.json(todos);
});

app.post('/api/todos', auth, async (req, res) => {
  const todo = new Todo({userId: req.userId, task: req.body.task, done: false});
  await todo.save();
  res.json(todo);
});

app.put('/api/todos/:id', auth, async (req, res) => {
  const todo = await Todo.findOne({_id: req.params.id, userId: req.userId});
  todo.done = !todo.done;
  await todo.save();
  res.json(todo);
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  await Todo.deleteOne({_id: req.params.id, userId: req.userId});
  res.json({success: true});
});

app.get('/api/quotes', async (req, res) => {
  const quotes = await Quote.find().sort({createdAt: -1}).limit(50);
  res.json(quotes);
});

app.post('/api/quotes', auth, async (req, res) => {
  const quote = new Quote({userId: req.userId, username: req.username, quote: req.body.quote});
  await quote.save();
  res.json(quote);
});

app.delete('/api/quotes/:id', auth, async (req, res) => {
  await Quote.deleteOne({_id: req.params.id, userId: req.userId});
  res.json({success: true});
});

app.listen(3000, () => console.log('Backend running on port 3000'));
