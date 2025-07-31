









const express = require('express');
const Visitor = require('../models/Visitor');
const User = require('../models/User');
const { auth, checkPermission } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics
// @access  Private
router.get('/dashboard', auth, checkPermission('view_analytics'), async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        
        // Calculate date range based on period
        let startDate = new Date();
        const endDate = new Date();
        
        switch (period) {
            case '1d':
                startDate.setDate(startDate.getDate() - 1);
                break;
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        // Get visitor analytics
        const visitorStats = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalVisitors: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: [{ $ne: ['$checkInTime', null] }, 1, 0] }
                    },
                    checkedOut: {
                        $sum: { $cond: [{ $ne: ['$checkOutTime', null] }, 1, 0] }
                    },
                    pendingApprovals: {
                        $sum: { $cond: [{ $eq: ['$approvalStatus', 'pending'] }, 1, 0] }
                    },
                    approved: {
                        $sum: { $cond: [{ $in: ['$approvalStatus', ['approved', 'auto_approved']] }, 1, 0] }
                    },
                    rejected: {
                        $sum: { $cond: [{ $eq: ['$approvalStatus', 'rejected'] }, 1, 0] }
                    },
                    avgVisitDuration: { $avg: '$visitDuration' },
                    noShow: {
                        $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayStats = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    expectedArrival: { $gte: today, $lt: tomorrow }
                }
            },
            {
                $group: {
                    _id: null,
                    scheduled: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: [{ $ne: ['$checkInTime', null] }, 1, 0] }
                    },
                    checkedOut: {
                        $sum: { $cond: [{ $ne: ['$checkOutTime', null] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get visitor trends
        const trends = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    visitors: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: [{ $ne: ['$checkInTime', null] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        // Get top hosts
        const topHosts = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$host',
                    visitorCount: { $sum: 1 },
                    uniqueVisitors: { $addToSet: '$email' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'host'
                }
            },
            {
                $unwind: '$host'
            },
            {
                $project: {
                    hostName: { $concat: ['$host.firstName', ' ', '$host.lastName'] },
                    hostEmail: '$host.email',
                    visitorCount: 1,
                    uniqueVisitors: { $size: '$uniqueVisitors' }
                }
            },
            {
                $sort: { visitorCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Get purpose analytics
        const purposeStats = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$purpose',
                    count: { $sum: 1 },
                    avgDuration: { $avg: '$visitDuration' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Get hourly distribution
        const hourlyDistribution = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    checkInTime: { $ne: null },
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $hour: '$checkInTime' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Get approval metrics
        const approvalMetrics = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
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

        res.json({
            period,
            summary: {
                visitorStats: visitorStats[0] || {
                    totalVisitors: 0,
                    checkedIn: 0,
                    checkedOut: 0,
                    pendingApprovals: 0,
                    approved: 0,
                    rejected: 0,
                    avgVisitDuration: 0,
                    noShow: 0
                },
                todayStats: todayStats[0] || {
                    scheduled: 0,
                    checkedIn: 0,
                    checkedOut: 0
                }
            },
            trends,
            topHosts,
            purposeStats,
            hourlyDistribution,
            approvalMetrics
        });
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/visitors
// @desc    Get detailed visitor analytics
// @access  Private
router.get('/visitors', auth, checkPermission('view_analytics'), async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        let groupByFormat;
        switch (groupBy) {
            case 'hour':
                groupByFormat = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' },
                    hour: { $hour: '$createdAt' }
                };
                break;
            case 'week':
                groupByFormat = {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
                break;
            case 'month':
                groupByFormat = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                break;
            default:
                groupByFormat = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
        }

        const analytics = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: groupByFormat,
                    totalVisitors: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: [{ $ne: ['$checkInTime', null] }, 1, 0] }
                    },
                    checkedOut: {
                        $sum: { $cond: [{ $ne: ['$checkOutTime', null] }, 1, 0] }
                    },
                    avgVisitDuration: { $avg: '$visitDuration' },
                    uniqueVisitors: { $addToSet: '$email' }
                }
            },
            {
                $addFields: {
                    uniqueVisitorCount: { $size: '$uniqueVisitors' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.json({ analytics });
    } catch (error) {
        console.error('Visitor analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/hosts
// @desc    Get host performance analytics
// @access  Private
router.get('/hosts', auth, checkPermission('view_analytics'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const hostAnalytics = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: '$host',
                    totalVisitors: { $sum: 1 },
                    checkedIn: {
                        $sum: { $cond: [{ $ne: ['$checkInTime', null] }, 1, 0] }
                    },
                    avgResponseTime: {
                        $avg: {
                            $cond: [
                                { $and: [{ $ne: ['$approvedAt', null] }, { $ne: ['$createdAt', null] }] },
                                { $divide: [{ $subtract: ['$approvedAt', '$createdAt'] }, 60000] },
                                null
                            ]
                        }
                    },
                    avgVisitDuration: { $avg: '$visitDuration' },
                    satisfactionRating: { $avg: '$satisfactionRating' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'host'
                }
            },
            {
                $unwind: '$host'
            },
            {
                $project: {
                    hostName: { $concat: ['$host.firstName', ' ', '$host.lastName'] },
                    hostEmail: '$host.email',
                    hostDepartment: '$host.department',
                    totalVisitors: 1,
                    checkedIn: 1,
                    avgResponseTime: 1,
                    avgVisitDuration: 1,
                    satisfactionRating: 1,
                    responseRate: {
                        $multiply: [
                            { $divide: ['$checkedIn', '$totalVisitors'] },
                            100
                        ]
                    }
                }
            },
            {
                $sort: { totalVisitors: -1 }
            }
        ]);

        res.json({ hosts: hostAnalytics });
    } catch (error) {
        console.error('Host analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/security
// @desc    Get security analytics
// @access  Private
router.get('/security', auth, checkPermission('view_analytics'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const securityAnalytics = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalVisitors: { $sum: 1 },
                    flaggedVisitors: {
                        $sum: {
                            $cond: [
                                { $gt: [{ $size: { $ifNull: ['$securityFlags', []] } }, 0] },
                                1,
                                0
                            ]
                        }
                    },
                    backgroundCheckPending: {
                        $sum: { $cond: [{ $eq: ['$backgroundCheck', 'pending'] }, 1, 0] }
                    },
                    backgroundCheckCleared: {
                        $sum: { $cond: [{ $eq: ['$backgroundCheck', 'cleared'] }, 1, 0] }
                    },
                    backgroundCheckFlagged: {
                        $sum: { $cond: [{ $eq: ['$backgroundCheck', 'flagged'] }, 1, 0] }
                    },
                    securityClearanceBasic: {
                        $sum: { $cond: [{ $eq: ['$securityClearance', 'basic'] }, 1, 0] }
                    },
                    securityClearanceElevated: {
                        $sum: { $cond: [{ $eq: ['$securityClearance', 'elevated'] }, 1, 0] }
                    },
                    securityClearanceRestricted: {
                        $sum: { $cond: [{ $eq: ['$securityClearance', 'restricted'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get security flags breakdown
        const securityFlags = await Visitor.aggregate([
            {
                $match: {
                    organization: req.user.organizationId,
                    createdAt: { $gte: start, $lte: end },
                    securityFlags: { $exists: true, $ne: [] }
                }
            },
            {
                $unwind: '$securityFlags'
            },
            {
                $group: {
                    _id: '$securityFlags',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.json({
            security: securityAnalytics[0] || {
                totalVisitors: 0,
                flaggedVisitors: 0,
                backgroundCheckPending: 0,
                backgroundCheckCleared: 0,
                backgroundCheckFlagged: 0,
                securityClearanceBasic: 0,
                securityClearanceElevated: 0,
                securityClearanceRestricted: 0
            },
            securityFlags
        });
    } catch (error) {
        console.error('Security analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.get('/export', auth, checkPermission('export_data'), async (req, res) => {
    try {
        const { startDate, endDate, format = 'json' } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const visitors = await Visitor.find({
            organization: req.user.organizationId,
            createdAt: { $gte: start, $lte: end }
        })
            .populate('host', 'firstName lastName email')
            .populate('approvedBy', 'firstName lastName')
            .lean();

        if (format === 'csv') {
            const csv = require('csv-stringify');
            const data = visitors.map(v => ({
                visitorId: v.visitorId,
                name: `${v.firstName} ${v.lastName}`,
                email: v.email,
                company: v.company,
                purpose: v.purpose,
                host: v.host ? `${v.host.firstName} ${v.host.lastName}` : '',
                expectedArrival: v.expectedArrival,
                checkInTime: v.checkInTime,
                checkOutTime: v.checkOutTime,
                status: v.status,
                approvalStatus: v.approvalStatus,
                visitDuration: v.visitDuration
            }));

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=visitor-analytics.csv');
            csv.stringify(data, { header: true }).pipe(res);
        } else {
            res.json({ visitors });
        }
    } catch (error) {
        console.error('Export analytics error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;








