const express = require('express');
const Session = require('../models/Session');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Default decks
const defaultDecks = ["Branded", "Ryzeal Mitsu", "Mitsu Pure", "Mitsu FS", "Orcust", "Maliss"];

// @desc    Get all sessions for user
// @route   GET /api/sessions
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const sessions = await Session.find({ user: req.user.id, isActive: true })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching sessions'
    });
  }
});

// @desc    Get single session
// @route   GET /api/sessions/:id
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching session'
    });
  }
});

// @desc    Create new session
// @route   POST /api/sessions
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, pointsFormula, pointsStart, defaultDeck, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Session name is required'
      });
    }

    const startPoints = pointsStart || (pointsFormula === 'dc' ? 0 : 1500);

    const session = await Session.create({
      user: req.user.id,
      name,
      pointsFormula: pointsFormula || 'rated',
      pointsStart: startPoints,
      defaultDeck,
      description,
      decks: defaultDecks.slice()
    });

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      session
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating session'
    });
  }
});

// @desc    Update session
// @route   PUT /api/sessions/:id
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, defaultDeck, description, tags, isActive } = req.body;

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { 
        $set: {
          ...(name && { name }),
          ...(defaultDeck !== undefined && { defaultDeck }),
          ...(description !== undefined && { description }),
          ...(tags && { tags }),
          ...(isActive !== undefined && { isActive })
        }
      },
      { new: true, runValidators: true }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session updated successfully',
      session
    });

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating session'
    });
  }
});

// @desc    Delete session
// @route   DELETE /api/sessions/:id
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting session'
    });
  }
});

// @desc    Add deck to session
// @route   POST /api/sessions/:id/decks
// @access  Private
router.post('/:id/decks', auth, async (req, res) => {
  try {
    const { deckName } = req.body;

    if (!deckName) {
      return res.status(400).json({
        success: false,
        message: 'Deck name is required'
      });
    }

    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.decks.includes(deckName)) {
      return res.status(400).json({
        success: false,
        message: 'Deck already exists in this session'
      });
    }

    session.decks.push(deckName);
    await session.save();

    res.json({
      success: true,
      message: 'Deck added successfully',
      session
    });

  } catch (error) {
    console.error('Add deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding deck'
    });
  }
});

// @desc    Remove deck from session
// @route   DELETE /api/sessions/:id/decks/:deckName
// @access  Private
router.delete('/:id/decks/:deckName', auth, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    session.decks = session.decks.filter(deck => deck !== req.params.deckName);
    await session.save();

    res.json({
      success: true,
      message: 'Deck removed successfully',
      session
    });

  } catch (error) {
    console.error('Remove deck error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing deck'
    });
  }
});

module.exports = router;