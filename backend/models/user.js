const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  profile: {
    displayName: String,
    avatar: String,
    bio: String
  },
  stats: {
    totalMatches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    currentPoints: { type: Number, default: 1500 },
    peakPoints: { type: Number, default: 1500 },
    bestWinStreak: { type: Number, default: 0 }
  },
  preferences: {
    theme: { type: String, default: 'default' },
    pointsFormula: { type: String, default: 'rated' },
    showDeckLists: { type: Boolean, default: true }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update stats method
userSchema.methods.updateStats = function(matchResult, pointsChange) {
  this.stats.totalMatches += 1;
  
  if (matchResult === 'Win') {
    this.stats.wins += 1;
    // Update win streak
    const currentStreak = this.stats.currentWinStreak || 0;
    this.stats.currentWinStreak = currentStreak + 1;
    this.stats.bestWinStreak = Math.max(this.stats.bestWinStreak, this.stats.currentWinStreak);
  } else {
    this.stats.losses += 1;
    this.stats.currentWinStreak = 0;
  }
  
  this.stats.currentPoints += pointsChange;
  this.stats.peakPoints = Math.max(this.stats.peakPoints, this.stats.currentPoints);
};

// Virtual for win rate
userSchema.virtual('winRate').get(function() {
  if (this.stats.totalMatches === 0) return 0;
  return Math.round((this.stats.wins / this.stats.totalMatches) * 1000) / 10;
});

// Hide password in JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);