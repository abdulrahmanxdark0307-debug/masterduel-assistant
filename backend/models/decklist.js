const mongoose = require('mongoose');

const deckListSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Deck name is required'],
    trim: true,
    maxlength: [100, 'Deck name cannot exceed 100 characters']
  },
  image: String,
  description: String,
  cards: [{
    name: String,
    count: Number,
    category: String // monster, spell, trap, extra
  }],
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  },
  stats: {
    matches: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    overallWR: { type: String, default: '0%' },
    wrGoing1st: { type: String, default: '0%' },
    wrGoing2nd: { type: String, default: '0%' }
  },
  format: {
    type: String,
    enum: ['tcg', 'ocg', 'masterduel'],
    default: 'masterduel'
  }
}, {
  timestamps: true
});

// Update deck statistics
deckListSchema.methods.updateStats = async function() {
  const Session = mongoose.model('Session');
  const sessions = await Session.find({ user: this.user, isActive: true });
  
  let matches = 0;
  let wins = 0;
  let matches1st = 0;
  let wins1st = 0;
  let matches2nd = 0;
  let wins2nd = 0;
  
  sessions.forEach(session => {
    const deckMatches = session.matches.filter(m => m.deck === this.name);
    matches += deckMatches.length;
    wins += deckMatches.filter(m => m.result === 'Win').length;
    
    const firstMatches = deckMatches.filter(m => m.turn === '1st');
    matches1st += firstMatches.length;
    wins1st += firstMatches.filter(m => m.result === 'Win').length;
    
    const secondMatches = deckMatches.filter(m => m.turn === '2nd');
    matches2nd += secondMatches.length;
    wins2nd += secondMatches.filter(m => m.result === 'Win').length;
  });
  
  this.stats.matches = matches;
  this.stats.wins = wins;
  this.stats.overallWR = matches > 0 ? `${Math.round((wins / matches) * 1000) / 10}%` : '0%';
  this.stats.wrGoing1st = matches1st > 0 ? `${Math.round((wins1st / matches1st) * 1000) / 10}%` : '0%';
  this.stats.wrGoing2nd = matches2nd > 0 ? `${Math.round((wins2nd / matches2nd) * 1000) / 10}%` : '0%';
};

module.exports = mongoose.model('DeckList', deckListSchema);