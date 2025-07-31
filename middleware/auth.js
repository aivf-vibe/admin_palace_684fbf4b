




const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Find user and check if still active
        const user = await User.findById(decoded.userId).populate('organization');
        if (!user) {
            return res.status(401).json({ message: 'Token is not valid' });
        }

        if (!user.isActive) {
            return res.status(401).json({ message: 'Account is deactivated' });
        }

        req.user = {
            userId: user._id,
            organizationId: user.organization._id,
            role: user.role,
            permissions: user.permissions
        };
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// Role-based authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                message: 'Access denied. Insufficient permissions' 
            });
        }
        next();
    };
};

// Permission-based authorization
const checkPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({ 
                message: 'Access denied. Required permission: ' + permission 
            });
        }
        next();
    };
};

// Organization-based authorization
const checkOrganization = async (req, res, next) => {
    try {
        const resourceId = req.params.id || req.body.organizationId;
        
        if (req.user.role === 'super_admin') {
            return next();
        }

        if (resourceId && resourceId !== req.user.organizationId.toString()) {
            return res.status(403).json({ 
                message: 'Access denied. Resource belongs to different organization' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Organization check error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { auth, authorize, checkPermission, checkOrganization };




