const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tournament title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Tournament description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  date: {
    type: Date,
    required: [true, 'Tournament date is required']
  },
  registerUrl: String,
  discordUrl: String,
  rules: String,
  prize: String,
  format: {
    type: String,
    enum: ['single-elimination', 'double-elimination', 'swiss', 'round-robin'],
    default: 'single-elimination'
  },
  platform: {
    type: String,
    enum: ['masterduel', 'duelingbook', 'other'],
    default: 'masterduel'
  },
  entryFee: {
    type: String,
    default: 'Free'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxParticipants: Number,
  currentParticipants: {
    type: Number,
    default: 0
  },
  tags: [String]
}, {
  timestamps: true
});

// Virtual for tournament status
tournamentSchema.virtual('status').get(function() {
  const now = new Date();
  if (this.date < now) return 'completed';
  if (this.date < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) return 'upcoming';
  return 'scheduled';
});

// Index for efficient queries
tournamentSchema.index({ date: 1 });
tournamentSchema.index({ isActive: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);