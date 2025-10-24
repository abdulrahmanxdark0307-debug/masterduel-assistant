const express = require('express');
const DeckList = require('../models/DeckList');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all decklists for user
// @route   GET /api/decklists
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const decklists = await DeckList.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    // Update stats for each decklist
    for (let decklist of decklists) {
      await decklist.updateStats();
      await decklist.save();
    }

    res.json({
      success: true,
      count: decklists.length,
      decklists
    });

  } catch (error) {
    console.error('Get decklists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching decklists'
    });
  }
});

// @desc    Get single decklist
// @route   GET /api/decklists/:id
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const decklist = await DeckList.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!decklist) {
      return res.status(404).json({
        success: false,
        message: 'Decklist not found'
      });
    }

    // Update stats
    await decklist.updateStats();
    await decklist.save();

    res.json({
      success: true,
      decklist
    });

  } catch (error) {
    console.error('Get decklist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching decklist'
    });
  }
});

// @desc    Create new decklist
// @route   POST /api/decklists
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { name, image, description, cards, tags, isPublic, format } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Decklist name is required'
      });
    }

    const decklist = await DeckList.create({
      user: req.user.id,
      name,
      image,
      description,
      cards: cards || [],
      tags: tags || [],
      isPublic: isPublic || false,
      format: format || 'masterduel'
    });

    res.status(201).json({
      success: true,
      message: 'Decklist created successfully',
      decklist
    });

  } catch (error) {
    console.error('Create decklist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating decklist'
    });
  }
});

// @desc    Update decklist
// @route   PUT /api/decklists/:id
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, image, description, cards, tags, isPublic, format } = req.body;

    const decklist = await DeckList.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { 
        $set: {
          ...(name && { name }),
          ...(image !== undefined && { image }),
          ...(description !== undefined && { description }),
          ...(cards && { cards }),
          ...(tags && { tags }),
          ...(isPublic !== undefined && { isPublic }),
          ...(format && { format })
        }
      },
      { new: true, runValidators: true }
    );

    if (!decklist) {
      return res.status(404).json({
        success: false,
        message: 'Decklist not found'
      });
    }

    res.json({
      success: true,
      message: 'Decklist updated successfully',
      decklist
    });

  } catch (error) {
    console.error('Update decklist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating decklist'
    });
  }
});

// @desc    Delete decklist
// @route   DELETE /api/decklists/:id
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const decklist = await DeckList.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!decklist) {
      return res.status(404).json({
        success: false,
        message: 'Decklist not found'
      });
    }

    res.json({
      success: true,
      message: 'Decklist deleted successfully'
    });

  } catch (error) {
    console.error('Delete decklist error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting decklist'
    });
  }
});

// @desc    Get public decklists
// @route   GET /api/decklists/public
// @access  Public
router.get('/public', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const decklists = await DeckList.find({ isPublic: true })
      .populate('user', 'username profile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await DeckList.countDocuments({ isPublic: true });

    res.json({
      success: true,
      count: decklists.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      decklists
    });

  } catch (error) {
    console.error('Get public decklists error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching public decklists'
    });
  }
});

module.exports = router;