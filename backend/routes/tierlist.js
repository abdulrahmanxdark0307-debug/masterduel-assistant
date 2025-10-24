const express = require('express');
const TierItem = require('../models/TierItem');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all tier items
// @route   GET /api/tier-list
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, sort = 'score', page = 1, limit = 20 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = { isApproved: true };
    if (category) {
      filter.category = category;
    }

    // Build sort
    let sortOption = {};
    switch (sort) {
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'score':
      default:
        sortOption = { score: -1 };
        break;
    }

    const tierItems = await TierItem.find(filter)
      .populate('submittedBy', 'username profile')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    // Add user vote information if authenticated
    let enhancedItems = tierItems;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        enhancedItems = tierItems.map(item => {
          const itemObj = item.toObject();
          itemObj.userVote = item.getUserVote(decoded.id);
          return itemObj;
        });
      } catch (error) {
        // Token is invalid, proceed without user vote info
      }
    }

    const total = await TierItem.countDocuments(filter);

    res.json({
      success: true,
      count: tierItems.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      tierItems: enhancedItems
    });

  } catch (error) {
    console.error('Get tier list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tier list'
    });
  }
});

// @desc    Get single tier item
// @route   GET /api/tier-list/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const tierItem = await TierItem.findById(req.params.id)
      .populate('submittedBy', 'username profile');

    if (!tierItem) {
      return res.status(404).json({
        success: false,
        message: 'Tier item not found'
      });
    }

    // Add user vote information if authenticated
    let enhancedItem = tierItem.toObject();
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        enhancedItem.userVote = tierItem.getUserVote(decoded.id);
      } catch (error) {
        // Token is invalid, proceed without user vote info
      }
    }

    res.json({
      success: true,
      tierItem: enhancedItem
    });

  } catch (error) {
    console.error('Get tier item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tier item'
    });
  }
});

// @desc    Create tier item (Admin only)
// @route   POST /api/tier-list
// @access  Private/Admin
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { title, imageUrl, description, category } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required'
      });
    }

    const tierItem = await TierItem.create({
      title,
      imageUrl,
      description,
      category: category || 'non-engine',
      submittedBy: req.user.id,
      isApproved: true // Auto-approve for admins
    });

    await tierItem.populate('submittedBy', 'username profile');

    res.status(201).json({
      success: true,
      message: 'Tier item created successfully',
      tierItem
    });

  } catch (error) {
    console.error('Create tier item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating tier item'
    });
  }
});

// @desc    Vote on tier item
// @route   POST /api/tier-list/:id/vote
// @access  Private
router.post('/:id/vote', auth, async (req, res) => {
  try {
    const { vote } = req.body;

    if (!vote || !['like', 'dislike'].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid vote type (like or dislike)'
      });
    }

    const tierItem = await TierItem.findById(req.params.id);

    if (!tierItem) {
      return res.status(404).json({
        success: false,
        message: 'Tier item not found'
      });
    }

    // Check if user has already voted
    const existingVoteIndex = tierItem.votes.findIndex(
      v => v.user.toString() === req.user.id
    );

    if (existingVoteIndex !== -1) {
      // Update existing vote
      if (tierItem.votes[existingVoteIndex].type === vote) {
        // Remove vote if same type clicked again
        tierItem.votes.splice(existingVoteIndex, 1);
      } else {
        // Change vote type
        tierItem.votes[existingVoteIndex].type = vote;
      }
    } else {
      // Add new vote
      tierItem.votes.push({
        user: req.user.id,
        type: vote
      });
    }

    // Recalculate score
    tierItem.score = tierItem.calculateScore();
    await tierItem.save();

    await tierItem.populate('submittedBy', 'username profile');

    // Add user vote information to response
    const responseItem = tierItem.toObject();
    responseItem.userVote = tierItem.getUserVote(req.user.id);

    res.json({
      success: true,
      message: 'Vote submitted successfully',
      tierItem: responseItem
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting vote'
    });
  }
});

// @desc    Update tier item (Admin only)
// @route   PUT /api/tier-list/:id
// @access  Private/Admin
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { title, imageUrl, description, category, isApproved } = req.body;

    const tierItem = await TierItem.findByIdAndUpdate(
      req.params.id,
      { 
        $set: {
          ...(title && { title }),
          ...(imageUrl && { imageUrl }),
          ...(description !== undefined && { description }),
          ...(category && { category }),
          ...(isApproved !== undefined && { isApproved })
        }
      },
      { new: true, runValidators: true }
    ).populate('submittedBy', 'username profile');

    if (!tierItem) {
      return res.status(404).json({
        success: false,
        message: 'Tier item not found'
      });
    }

    res.json({
      success: true,
      message: 'Tier item updated successfully',
      tierItem
    });

  } catch (error) {
    console.error('Update tier item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tier item'
    });
  }
});

// @desc    Delete tier item (Admin only)
// @route   DELETE /api/tier-list/:id
// @access  Private/Admin
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const tierItem = await TierItem.findByIdAndDelete(req.params.id);

    if (!tierItem) {
      return res.status(404).json({
        success: false,
        message: 'Tier item not found'
      });
    }

    res.json({
      success: true,
      message: 'Tier item deleted successfully'
    });

  } catch (error) {
    console.error('Delete tier item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting tier item'
    });
  }
});

// @desc    Get pending tier items (Admin only)
// @route   GET /api/tier-list/pending
// @access  Private/Admin
router.get('/pending', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tierItems = await TierItem.find({ isApproved: false })
      .populate('submittedBy', 'username profile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TierItem.countDocuments({ isApproved: false });

    res.json({
      success: true,
      count: tierItems.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      tierItems
    });

  } catch (error) {
    console.error('Get pending tier items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching pending tier items'
    });
  }
});

module.exports = router;