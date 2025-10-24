const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'dislike'],
    required: true
  }
}, {
  timestamps: true
});

const tierItemSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  description: String,
  category: {
    type: String,
    enum: ['non-engine', 'engine', 'staple', 'tech'],
    default: 'non-engine'
  },
  votes: [voteSchema],
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  score: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Calculate score based on votes
tierItemSchema.methods.calculateScore = function() {
  const likes = this.votes.filter(v => v.type === 'like').length;
  const dislikes = this.votes.filter(v => v.type === 'dislike').length;
  return likes - dislikes;
};

// Update score before saving
tierItemSchema.pre('save', function(next) {
  this.score = this.calculateScore();
  next();
});

// Check if user has voted
tierItemSchema.methods.hasUserVoted = function(userId) {
  return this.votes.find(v => v.user.toString() === userId.toString());
};

// Get user's vote type
tierItemSchema.methods.getUserVote = function(userId) {
  const vote = this.votes.find(v => v.user.toString() === userId.toString());
  return vote ? vote.type : null;
};

module.exports = mongoose.model('TierItem', tierItemSchema);