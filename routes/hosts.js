





const express = require('express');
const User = require('../models/User');
const { auth, checkPermission } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/hosts
// @desc    Get all hosts in organization
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { department, search } = req.query;
        
        const query = {
            organization: req.user.organizationId,
            role: { $in: ['employee', 'host', 'admin', 'receptionist'] },
            isActive: true
        };

        if (department) {
            query.department = department;
        }

        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } }
            ];
        }

        const hosts = await User.find(query)
            .select('firstName lastName email department position employeeId avatar')
            .sort({ firstName: 1 });

        res.json({ hosts });
    } catch (error) {
        console.error('Get hosts error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/hosts/:id/visitors
// @desc    Get visitors for specific host
// @access  Private
router.get('/:id/visitors', auth, async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;
        
        const query = {
            host: req.params.id,
            organization: req.user.organizationId
        };

        if (startDate && endDate) {
            query.expectedArrival = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        if (status) {
            query.status = status;
        }

        const visitors = await Visitor.find(query)
            .select('firstName lastName email company purpose expectedArrival checkInTime checkOutTime status')
            .sort({ expectedArrival: -1 });

        res.json({ visitors });
    } catch (error) {
        console.error('Get host visitors error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;




