






const express = require('express');
const { body, validationResult } = require('express-validator');
const Visitor = require('../models/Visitor');
const User = require('../models/User');
const { auth, checkPermission, checkOrganization } = require('../middleware/auth');
const router = express.Router();

// @route   POST /api/visitors
// @desc    Create a new visitor
// @access  Private
router.post('/', auth, [
    body('firstName').trim().isLength({ min: 1 }).withMessage('First name is required'),
    body('lastName').trim().isLength({ min: 1 }).withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').trim().isLength({ min: 10 }).withMessage('Valid phone number is required'),
    body('purpose').isIn(['meeting', 'interview', 'delivery', 'maintenance', 'tour', 'other']).withMessage('Valid purpose is required'),
    body('host').isMongoId().withMessage('Valid host ID is required'),
    body('expectedArrival').isISO8601().withMessage('Valid arrival date is required'),
    body('location').isMongoId().withMessage('Valid location ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const visitorData = {
            ...req.body,
            organization: req.user.organizationId,
            createdBy: req.user.userId
        };

        // Check if host exists and belongs to organization
        const host = await User.findOne({
            _id: visitorData.host,
            organization: req.user.organizationId
        });
        
        if (!host) {
            return res.status(400).json({ message: 'Invalid host' });
        }

        // Auto-approval logic for trusted visitors
        const existingVisitor = await Visitor.findOne({
            email: visitorData.email,
            organization: req.user.organizationId,
            approvalStatus: 'approved'
        });

        if (existingVisitor) {
            visitorData.approvalStatus = 'auto_approved';
            visitorData.approvedBy = req.user.userId;
            visitorData.approvedAt = new Date();
        }

        const visitor = new Visitor(visitorData);
        await visitor.save();

        // Populate host information
        await visitor.populate('host', 'firstName lastName email department');

        // Emit real-time update
        const io = req.app.get('io');
        io.to(req.user.organizationId).emit('new-visitor', visitor);

        res.status(201).json({
            message: 'Visitor created successfully',
            visitor
        });
    } catch (error) {
        console.error('Create visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/visitors
// @desc    Get all visitors for organization
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            approvalStatus,
            startDate,
            endDate,
            host,
            search
        } = req.query;

        const query = { organization: req.user.organizationId };

        // Filter by status
        if (status) query.status = status;
        if (approvalStatus) query.approvalStatus = approvalStatus;
        if (host) query.host = host;

        // Date range filter
        if (startDate || endDate) {
            query.expectedArrival = {};
            if (startDate) query.expectedArrival.$gte = new Date(startDate);
            if (endDate) query.expectedArrival.$lte = new Date(endDate);
        }

        // Search functionality
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } }
            ];
        }

        const visitors = await Visitor.find(query)
            .populate('host', 'firstName lastName email department')
            .populate('approvedBy', 'firstName lastName')
            .sort({ expectedArrival: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Visitor.countDocuments(query);

        res.json({
            visitors,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get visitors error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/visitors/today
// @desc    Get today's visitors
// @access  Private
router.get('/today', auth, async (req, res) => {
    try {
        const visitors = await Visitor.getTodayVisitors(req.user.organizationId)
            .populate('host', 'firstName lastName email department')
            .sort({ expectedArrival: 1 });

        res.json({ visitors });
    } catch (error) {
        console.error('Get today visitors error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/visitors/:id
// @desc    Get single visitor
// @access  Private
router.get('/:id', auth, checkOrganization, async (req, res) => {
    try {
        const visitor = await Visitor.findOne({
            _id: req.params.id,
            organization: req.user.organizationId
        })
            .populate('host', 'firstName lastName email department position')
            .populate('approvedBy', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email');

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        res.json({ visitor });
    } catch (error) {
        console.error('Get visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/visitors/:id
// @desc    Update visitor
// @access  Private
router.put('/:id', auth, checkOrganization, async (req, res) => {
    try {
        const visitor = await Visitor.findOneAndUpdate(
            { _id: req.params.id, organization: req.user.organizationId },
            { ...req.body, updatedBy: req.user.userId },
            { new: true, runValidators: true }
        )
            .populate('host', 'firstName lastName email department');

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        res.json({
            message: 'Visitor updated successfully',
            visitor
        });
    } catch (error) {
        console.error('Update visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/visitors/:id/approve
// @desc    Approve visitor
// @access  Private
router.put('/:id/approve', auth, checkPermission('approve_visitors'), async (req, res) => {
    try {
        const { approved } = req.body;
        const visitor = await Visitor.findOne({
            _id: req.params.id,
            organization: req.user.organizationId
        });

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        visitor.approvalStatus = approved ? 'approved' : 'rejected';
        visitor.approvedBy = req.user.userId;
        visitor.approvedAt = new Date();
        
        if (!approved && req.body.reason) {
            visitor.rejectionReason = req.body.reason;
        }

        await visitor.save();
        await visitor.populate('host', 'firstName lastName email');

        // Emit real-time update
        const io = req.app.get('io');
        io.to(req.user.organizationId).emit('approval-status-changed', visitor);

        res.json({
            message: `Visitor ${approved ? 'approved' : 'rejected'} successfully`,
            visitor
        });
    } catch (error) {
        console.error('Approve visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/visitors/:id/checkin
// @desc    Check in visitor
// @access  Private
router.put('/:id/checkin', auth, checkPermission('manage_visitors'), async (req, res) => {
    try {
        const visitor = await Visitor.findOne({
            _id: req.params.id,
            organization: req.user.organizationId
        });

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        if (visitor.status === 'checked_in') {
            return res.status(400).json({ message: 'Visitor already checked in' });
        }

        visitor.checkInTime = new Date();
        visitor.status = 'checked_in';
        await visitor.save();

        res.json({
            message: 'Visitor checked in successfully',
            visitor
        });
    } catch (error) {
        console.error('Check in visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/visitors/:id/checkout
// @desc    Check out visitor
// @access  Private
router.put('/:id/checkout', auth, checkPermission('manage_visitors'), async (req, res) => {
    try {
        const visitor = await Visitor.findOne({
            _id: req.params.id,
            organization: req.user.organizationId
        });

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        if (visitor.status === 'checked_out') {
            return res.status(400).json({ message: 'Visitor already checked out' });
        }

        visitor.checkOutTime = new Date();
        visitor.status = 'checked_out';
        visitor.actualDeparture = new Date();
        
        // Calculate visit duration
        if (visitor.checkInTime) {
            visitor.visitDuration = Math.round((visitor.checkOutTime - visitor.checkInTime) / (1000 * 60));
        }

        await visitor.save();

        res.json({
            message: 'Visitor checked out successfully',
            visitor
        });
    } catch (error) {
        console.error('Check out visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/visitors/:id
// @desc    Cancel visitor
// @access  Private
router.delete('/:id', auth, checkOrganization, async (req, res) => {
    try {
        const visitor = await Visitor.findOneAndUpdate(
            { _id: req.params.id, organization: req.user.organizationId },
            { status: 'cancelled', updatedBy: req.user.userId },
            { new: true }
        );

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        res.json({ message: 'Visitor cancelled successfully' });
    } catch (error) {
        console.error('Cancel visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/visitors/qr/:qrCode
// @desc    Get visitor by QR code
// @access  Private
router.get('/qr/:qrCode', auth, async (req, res) => {
    try {
        const visitor = await Visitor.findOne({
            qrCode: req.params.qrCode,
            organization: req.user.organizationId
        }).populate('host', 'firstName lastName email department');

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        res.json({ visitor });
    } catch (error) {
        console.error('Get visitor by QR error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;






