const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  deck: {
    type: String,
    required: true,
    trim: true
  },
  opp: {
    type: String,
    required: true,
    trim: true
  },
  result: {
    type: String,
    enum: ['Win', 'Loss'],
    required: true
  },
  turn: {
    type: String,
    enum: ['1st', '2nd'],
    required: true
  },
  pointsBefore: {
    type: Number,
    required: true
  },
  pointsAfter: {
    type: Number,
    required: true
  },
  customPointsAfter: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  notes: String
});

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Session name is required'],
    trim: true,
    maxlength: [100, 'Session name cannot exceed 100 characters']
  },
  matches: [matchSchema],
  decks: [{
    type: String,
    trim: true
  }],
  pointsFormula: {
    type: String,
    enum: ['rated', 'dc'],
    default: 'rated'
  },
  pointsStart: {
    type: Number,
    default: 1500
  },
  defaultDeck: String,
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String],
  description: String
}, {
  timestamps: true
});

// Calculate session statistics
sessionSchema.virtual('stats').get(function() {
  const matches = this.matches;
  const total = matches.length;
  const wins = matches.filter(m => m.result === 'Win').length;
  const losses = total - wins;
  const winRate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
  
  const matches1st = matches.filter(m => m.turn === '1st');
  const wins1st = matches1st.filter(m => m.result === 'Win').length;
  const winRate1st = matches1st.length > 0 ? Math.round((wins1st / matches1st.length) * 1000) / 10 : 0;
  
  const matches2nd = matches.filter(m => m.turn === '2nd');
  const wins2nd = matches2nd.filter(m => m.result === 'Win').length;
  const winRate2nd = matches2nd.length > 0 ? Math.round((wins2nd / matches2nd.length) * 1000) / 10 : 0;
  
  const currentPoints = total > 0 ? matches[matches.length - 1].pointsAfter : this.pointsStart;
  const peakPoints = Math.max(...matches.map(m => m.pointsAfter), this.pointsStart);
  
  return {
    total,
    wins,
    losses,
    winRate,
    winRate1st,
    winRate2nd,
    currentPoints,
    peakPoints
  };
});

// Update user stats when session is modified
sessionSchema.post('save', async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  
  if (user) {
    // Recalculate user stats based on all sessions
    const Session = mongoose.model('Session');
    const sessions = await Session.find({ user: this.user, isActive: true });
    
    let totalMatches = 0;
    let wins = 0;
    let currentPoints = this.pointsFormula === 'rated' ? 1500 : 0;
    let peakPoints = currentPoints;
    
    sessions.forEach(session => {
      totalMatches += session.matches.length;
      wins += session.matches.filter(m => m.result === 'Win').length;
      
      if (session.matches.length > 0) {
        const sessionPoints = session.matches[session.matches.length - 1].pointsAfter;
        currentPoints = sessionPoints; // This should be more sophisticated
        peakPoints = Math.max(peakPoints, ...session.matches.map(m => m.pointsAfter));
      }
    });
    
    user.stats.totalMatches = totalMatches;
    user.stats.wins = wins;
    user.stats.losses = totalMatches - wins;
    user.stats.currentPoints = currentPoints;
    user.stats.peakPoints = peakPoints;
    
    await user.save();
  }
});

module.exports = mongoose.model('Session', sessionSchema);