const express = require('express');
const Session = require('../models/Session');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @desc    Add match to session
// @route   POST /api/sessions/:id/matches
// @access  Private
router.post('/:id/matches', auth, async (req, res) => {
  try {
    const { deck, opp, result, turn, customPointsAfter } = req.body;

    // Validation
    if (!deck || !opp || !result || !turn) {
      return res.status(400).json({
        success: false,
        message: 'Please provide deck, opponent, result, and turn order'
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

    // Calculate points
    const lastMatch = session.matches[session.matches.length - 1];
    const lastPoints = lastMatch ? lastMatch.pointsAfter : session.pointsStart;

    let newPoints;
    if (customPointsAfter !== undefined) {
      newPoints = customPointsAfter;
    } else {
      if (session.pointsFormula === 'rated') {
        newPoints = result === 'Win' ? lastPoints + 7 : lastPoints - 7;
      } else {
        // DC formula
        if (result === 'Win') {
          newPoints = lastPoints + 1;
        } else {
          newPoints = lastPoints < 15 ? lastPoints - 0.5 : lastPoints - 1;
        }
      }
    }

    const matchData = {
      deck,
      opp,
      result,
      turn,
      pointsBefore: lastPoints,
      pointsAfter: newPoints,
      ...(customPointsAfter !== undefined && { customPointsAfter })
    };

    session.matches.push(matchData);
    await session.save();

    // Get the newly added match
    const newMatch = session.matches[session.matches.length - 1];

    res.status(201).json({
      success: true,
      message: 'Match added successfully',
      match: newMatch,
      session
    });

  } catch (error) {
    console.error('Add match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding match'
    });
  }
});

// @desc    Update match
// @route   PUT /api/sessions/:sessionId/matches/:matchId
// @access  Private
router.put('/:sessionId/matches/:matchId', auth, async (req, res) => {
  try {
    const { deck, opp, result, turn, customPointsAfter } = req.body;

    const session = await Session.findOne({
      _id: req.params.sessionId,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const matchIndex = session.matches.findIndex(
      match => match._id.toString() === req.params.matchId
    );

    if (matchIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Update match data
    if (deck) session.matches[matchIndex].deck = deck;
    if (opp) session.matches[matchIndex].opp = opp;
    if (result) session.matches[matchIndex].result = result;
    if (turn) session.matches[matchIndex].turn = turn;
    if (customPointsAfter !== undefined) {
      session.matches[matchIndex].customPointsAfter = customPointsAfter;
      session.matches[matchIndex].pointsAfter = customPointsAfter;
    }

    // Recalculate subsequent matches if points changed
    if (customPointsAfter !== undefined) {
      for (let i = matchIndex + 1; i < session.matches.length; i++) {
        const prevMatch = session.matches[i - 1];
        session.matches[i].pointsBefore = prevMatch.pointsAfter;
        
        // Recalculate points if no custom override
        if (session.matches[i].customPointsAfter === undefined) {
          if (session.pointsFormula === 'rated') {
            session.matches[i].pointsAfter = session.matches[i].result === 'Win' 
              ? session.matches[i].pointsBefore + 7 
              : session.matches[i].pointsBefore - 7;
          } else {
            // DC formula
            if (session.matches[i].result === 'Win') {
              session.matches[i].pointsAfter = session.matches[i].pointsBefore + 1;
            } else {
              session.matches[i].pointsAfter = session.matches[i].pointsBefore < 15 
                ? session.matches[i].pointsBefore - 0.5 
                : session.matches[i].pointsBefore - 1;
            }
          }
        }
      }
    }

    await session.save();

    res.json({
      success: true,
      message: 'Match updated successfully',
      match: session.matches[matchIndex],
      session
    });

  } catch (error) {
    console.error('Update match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating match'
    });
  }
});

// @desc    Delete match
// @route   DELETE /api/sessions/:sessionId/matches/:matchId
// @access  Private
router.delete('/:sessionId/matches/:matchId', auth, async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.sessionId,
      user: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const matchIndex = session.matches.findIndex(
      match => match._id.toString() === req.params.matchId
    );

    if (matchIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    session.matches.splice(matchIndex, 1);

    // Recalculate points for subsequent matches
    for (let i = matchIndex; i < session.matches.length; i++) {
      const prevPoints = i === 0 ? session.pointsStart : session.matches[i - 1].pointsAfter;
      session.matches[i].pointsBefore = prevPoints;
      
      if (session.matches[i].customPointsAfter === undefined) {
        if (session.pointsFormula === 'rated') {
          session.matches[i].pointsAfter = session.matches[i].result === 'Win' 
            ? prevPoints + 7 
            : prevPoints - 7;
        } else {
          // DC formula
          if (session.matches[i].result === 'Win') {
            session.matches[i].pointsAfter = prevPoints + 1;
          } else {
            session.matches[i].pointsAfter = prevPoints < 15 
              ? prevPoints - 0.5 
              : prevPoints - 1;
          }
        }
      }
    }

    await session.save();

    res.json({
      success: true,
      message: 'Match deleted successfully',
      session
    });

  } catch (error) {
    console.error('Delete match error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting match'
    });
  }
});

// @desc    Clear all matches from session
// @route   DELETE /api/sessions/:id/matches
// @access  Private
router.delete('/:id/matches', auth, async (req, res) => {
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

    session.matches = [];
    await session.save();

    res.json({
      success: true,
      message: 'All matches cleared successfully',
      session
    });

  } catch (error) {
    console.error('Clear matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing matches'
    });
  }
});

module.exports = router;