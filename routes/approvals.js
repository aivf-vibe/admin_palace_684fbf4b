






const express = require('express');
const Visitor = require('../models/Visitor');
const { auth, checkPermission } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/approvals/pending
// @desc    Get pending approvals
// @access  Private
router.get('/pending', auth, checkPermission('approve_visitors'), async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const pendingApprovals = await Visitor.find({
            organization: req.user.organizationId,
            approvalStatus: 'pending'
        })
            .populate('host', 'firstName lastName email department')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Visitor.countDocuments({
            organization: req.user.organizationId,
            approvalStatus: 'pending'
        });

        res.json({
            approvals: pendingApprovals,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get pending approvals error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/approvals/history
// @desc    Get approval history
// @access  Private
router.get('/history', auth, checkPermission('approve_visitors'), async (req, res) => {
    try {
        const { page = 1, limit = 10, startDate, endDate } = req.query;

        const query = {
            organization: req.user.organizationId,
            approvalStatus: { $in: ['approved', 'rejected', 'auto_approved'] }
        };

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const history = await Visitor.find(query)
            .populate('host', 'firstName lastName email department')
            .populate('approvedBy', 'firstName lastName')
            .sort({ approvedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Visitor.countDocuments(query);

        res.json({
            history,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get approval history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/approvals/:id/approve
// @desc    Approve visitor (one-step approval)
// @access  Private
router.put('/:id/approve', auth, checkPermission('approve_visitors'), async (req, res) => {
    try {
        const { approved, reason } = req.body;

        const visitor = await Visitor.findOne({
            _id: req.params.id,
            organization: req.user.organizationId
        }).populate('host', 'firstName lastName email');

        if (!visitor) {
            return res.status(404).json({ message: 'Visitor not found' });
        }

        if (visitor.approvalStatus !== 'pending') {
            return res.status(400).json({ message: 'Visitor has already been processed' });
        }

        visitor.approvalStatus = approved ? 'approved' : 'rejected';
        visitor.approvedBy = req.user.userId;
        visitor.approvedAt = new Date();
        
        if (!approved && reason) {
            visitor.rejectionReason = reason;
        }

        await visitor.save();

        // Emit real-time update
        const io = req.app.get('io');
        io.to(req.user.organizationId).emit('approval-completed', {
            visitor,
            approved,
            approvedBy: req.user.userId
        });

        res.json({
            message: `Visitor ${approved ? 'approved' : 'rejected'} successfully`,
            visitor
        });
    } catch (error) {
        console.error('Approve visitor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/approvals/stats
// @desc    Get approval statistics
// @access  Private
router.get('/stats', auth, checkPermission('approve_visitors'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const matchQuery = {
            organization: req.user.organizationId
        };

        if (startDate && endDate) {
            matchQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const stats = await Visitor.aggregate([
            {
                $match: matchQuery
            },
            {
                $group: {
                    _id: '$approvalStatus',
                    count: { $sum: 1 },
                    avgResponseTime: {
                        $avg: {
                            $cond: [
                                { $and: [{ $ne: ['$approvedAt', null] }, { $ne: ['$createdAt', null] }] },
                                { $divide: [{ $subtract: ['$approvedAt', '$createdAt'] }, 60000] },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        const totalProcessed = await Visitor.countDocuments({
            ...matchQuery,
            approvalStatus: { $in: ['approved', 'rejected', 'auto_approved'] }
        });

        const totalPending = await Visitor.countDocuments({
            ...matchQuery,
            approvalStatus: 'pending'
        });

        res.json({
            stats,
            totalProcessed,
            totalPending,
            averageResponseTime: stats.reduce((acc, curr) => {
                if (curr.avgResponseTime) {
                    return acc + curr.avgResponseTime;
                }
                return acc;
            }, 0) / stats.filter(s => s.avgResponseTime).length || 0
        });
    } catch (error) {
        console.error('Get approval stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;






