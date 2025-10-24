const express = require('express');
const User = require('../models/User');
const Session = require('../models/Session');

const router = express.Router();

// @desc    Get leaderboard
// @route   GET /api/leaderboard
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { formula = 'rated', circle, page = 1, limit = 50 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter based on circle
    let pointsFilter = {};
    if (circle) {
      const [min, max] = circle.split('-').map(Number);
      if (formula === 'rated') {
        pointsFilter = { 
          'stats.currentPoints': { 
            $gte: min, 
            ...(max && { $lt: max }) 
          } 
        };
      } else {
        // DC formula - circles are every 10k points
        pointsFilter = { 
          'stats.currentPoints': { 
            $gte: min, 
            ...(max && { $lt: max }) 
          } 
        };
      }
    }

    const users = await User.find({
      ...pointsFilter,
      isActive: true,
      'stats.totalMatches': { $gt: 0 } // Only include users with matches
    })
    .select('username profile stats')
    .sort({ 'stats.currentPoints': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Calculate ranks
    const rankedUsers = users.map((user, index) => ({
      rank: skip + index + 1,
      id: user._id,
      username: user.username,
      displayName: user.profile?.displayName || user.username,
      points: user.stats.currentPoints,
      totalMatches: user.stats.totalMatches,
      winRate: Math.round((user.stats.wins / user.stats.totalMatches) * 1000) / 10,
      peakPoints: user.stats.peakPoints,
      bestWinStreak: user.stats.bestWinStreak
    }));

    const total = await User.countDocuments({
      ...pointsFilter,
      isActive: true,
      'stats.totalMatches': { $gt: 0 }
    });

    res.json({
      success: true,
      formula,
      circle: circle || 'all',
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      users: rankedUsers
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching leaderboard'
    });
  }
});

// @desc    Get player stats
// @route   GET /api/leaderboard/player/:userId
// @access  Public
router.get('/player/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username profile stats createdAt');

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    // Get user's sessions and matches
    const sessions = await Session.find({ 
      user: req.params.userId, 
      isActive: true 
    });

    // Calculate deck performance
    const deckStats = {};
    const recentMatches = [];
    let totalMatches = 0;

    sessions.forEach(session => {
      session.matches.forEach(match => {
        totalMatches++;
        
        // Track recent matches (last 20)
        if (recentMatches.length < 20) {
          recentMatches.unshift({
            deck: match.deck,
            opponent: match.opp,
            result: match.result,
            date: match.createdAt
          });
        }

        // Calculate deck stats
        if (!deckStats[match.deck]) {
          deckStats[match.deck] = {
            name: match.deck,
            matches: 0,
            wins: 0,
            winRate: 0
          };
        }

        deckStats[match.deck].matches++;
        if (match.result === 'Win') {
          deckStats[match.deck].wins++;
        }
      });
    });

    // Calculate win rates for decks
    Object.values(deckStats).forEach(deck => {
      deck.winRate = Math.round((deck.wins / deck.matches) * 1000) / 10;
    });

    const deckStatsArray = Object.values(deckStats)
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 10); // Top 10 decks by usage

    res.json({
      success: true,
      player: {
        id: user._id,
        username: user.username,
        displayName: user.profile?.displayName || user.username,
        joinDate: user.createdAt,
        stats: user.stats,
        deckStats: deckStatsArray,
        recentMatches: recentMatches.slice(0, 10), // Last 10 matches
        totalMatches
      }
    });

  } catch (error) {
    console.error('Get player stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching player stats'
    });
  }
});

// @desc    Get meta statistics
// @route   GET /api/leaderboard/meta
// @access  Public
router.get('/meta', async (req, res) => {
  try {
    const { circle, formula = 'rated' } = req.query;

    // Build circle filter
    let circleFilter = {};
    if (circle) {
      const [min, max] = circle.split('-').map(Number);
      circleFilter = { 
        'stats.currentPoints': { 
          $gte: min, 
          ...(max && { $lt: max }) 
        } 
      };
    }

    const activeUsers = await User.countDocuments({
      ...circleFilter,
      isActive: true,
      'stats.totalMatches': { $gt: 0 }
    });

    // Get deck usage from sessions
    const deckUsage = await Session.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$matches' },
      {
        $group: {
          _id: '$matches.deck',
          totalMatches: { $sum: 1 },
          wins: { 
            $sum: { 
              $cond: [{ $eq: ['$matches.result', 'Win'] }, 1, 0] 
            } 
          }
        }
      },
      {
        $project: {
          deck: '$_id',
          totalMatches: 1,
          wins: 1,
          winRate: { $round: [{ $multiply: [{ $divide: ['$wins', '$totalMatches'] }, 100] }, 1] }
        }
      },
      { $sort: { totalMatches: -1 } },
      { $limit: 20 }
    ]);

    // Get opponent deck usage
    const opponentUsage = await Session.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$matches' },
      {
        $group: {
          _id: '$matches.opp',
          totalMatches: { $sum: 1 },
          wins: { 
            $sum: { 
              $cond: [{ $eq: ['$matches.result', 'Loss'] }, 1, 0] 
            } 
          }
        }
      },
      {
        $project: {
          deck: '$_id',
          totalMatches: 1,
          wins: 1,
          winRate: { $round: [{ $multiply: [{ $divide: ['$wins', '$totalMatches'] }, 100] }, 1] }
        }
      },
      { $sort: { totalMatches: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      meta: {
        activeUsers,
        totalMatches: deckUsage.reduce((sum, deck) => sum + deck.totalMatches, 0),
        deckUsage,
        opponentUsage
      }
    });

  } catch (error) {
    console.error('Get meta stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching meta statistics'
    });
  }
});

module.exports = router;