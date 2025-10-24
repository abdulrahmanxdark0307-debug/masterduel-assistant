const express = require('express');
const Tournament = require('../models/Tournament');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all tournaments
// @route   GET /api/tournaments
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, platform, page = 1, limit = 10 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = { isActive: true };
    
    if (status) {
      const now = new Date();
      switch (status) {
        case 'upcoming':
          filter.date = { $gte: now, $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
          break;
        case 'scheduled':
          filter.date = { $gt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
          break;
        case 'completed':
          filter.date = { $lt: now };
          break;
      }
    }

    if (platform) {
      filter.platform = platform;
    }

    const tournaments = await Tournament.find(filter)
      .populate('createdBy', 'username profile')
      .sort({ date: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tournament.countDocuments(filter);

    res.json({
      success: true,
      count: tournaments.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      tournaments
    });

  } catch (error) {
    console.error('Get tournaments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tournaments'
    });
  }
});

// @desc    Get single tournament
// @route   GET /api/tournaments/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('createdBy', 'username profile');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.json({
      success: true,
      tournament
    });

  } catch (error) {
    console.error('Get tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tournament'
    });
  }
});

// @desc    Create tournament (Admin only)
// @route   POST /api/tournaments
// @access  Private/Admin
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      registerUrl,
      discordUrl,
      rules,
      prize,
      format,
      platform,
      entryFee,
      maxParticipants,
      tags
    } = req.body;

    if (!title || !description || !date) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and date are required'
      });
    }

    const tournament = await Tournament.create({
      title,
      description,
      date,
      registerUrl,
      discordUrl,
      rules,
      prize,
      format: format || 'single-elimination',
      platform: platform || 'masterduel',
      entryFee: entryFee || 'Free',
      maxParticipants,
      tags: tags || [],
      createdBy: req.user.id
    });

    await tournament.populate('createdBy', 'username profile');

    res.status(201).json({
      success: true,
      message: 'Tournament created successfully',
      tournament
    });

  } catch (error) {
    console.error('Create tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating tournament'
    });
  }
});

// @desc    Update tournament (Admin only)
// @route   PUT /api/tournaments/:id
// @access  Private/Admin
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      registerUrl,
      discordUrl,
      rules,
      prize,
      format,
      platform,
      entryFee,
      maxParticipants,
      tags,
      isActive
    } = req.body;

    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      { 
        $set: {
          ...(title && { title }),
          ...(description && { description }),
          ...(date && { date }),
          ...(registerUrl !== undefined && { registerUrl }),
          ...(discordUrl !== undefined && { discordUrl }),
          ...(rules !== undefined && { rules }),
          ...(prize !== undefined && { prize }),
          ...(format && { format }),
          ...(platform && { platform }),
          ...(entryFee !== undefined && { entryFee }),
          ...(maxParticipants !== undefined && { maxParticipants }),
          ...(tags && { tags }),
          ...(isActive !== undefined && { isActive })
        }
      },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username profile');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.json({
      success: true,
      message: 'Tournament updated successfully',
      tournament
    });

  } catch (error) {
    console.error('Update tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tournament'
    });
  }
});

// @desc    Delete tournament (Admin only)
// @route   DELETE /api/tournaments/:id
// @access  Private/Admin
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndDelete(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    res.json({
      success: true,
      message: 'Tournament deleted successfully'
    });

  } catch (error) {
    console.error('Delete tournament error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting tournament'
    });
  }
});

// @desc    Register for tournament
// @route   POST /api/tournaments/:id/register
// @access  Private
router.post('/:id/register', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }

    // Check if tournament is in the future
    if (tournament.date < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot register for completed tournament'
      });
    }

    // Check if tournament has participant limit
    if (tournament.maxParticipants && tournament.currentParticipants >= tournament.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Tournament is full'
      });
    }

    // In a real application, you would have a separate registration model
    // For now, we'll just increment the participant count
    tournament.currentParticipants += 1;
    await tournament.save();

    res.json({
      success: true,
      message: 'Successfully registered for tournament',
      tournament
    });

  } catch (error) {
    console.error('Tournament registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while registering for tournament'
    });
  }
});

module.exports = router;