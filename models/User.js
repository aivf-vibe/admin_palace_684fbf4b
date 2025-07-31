



const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true,
        default: () => 'USR' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase()
    },
    
    // Basic Information
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    
    // Authentication
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    
    // Role & Permissions
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'security', 'receptionist', 'employee', 'host'],
        default: 'employee'
    },
    permissions: [{
        type: String,
        enum: [
            'manage_visitors',
            'approve_visitors',
            'view_analytics',
            'manage_users',
            'manage_locations',
            'manage_settings',
            'security_access',
            'export_data'
        ]
    }],
    
    // Organization
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    
    // Department & Position
    department: {
        type: String,
        trim: true
    },
    position: {
        type: String,
        trim: true
    },
    employeeId: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // Profile Information
    avatar: {
        type: String // URL to profile photo
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    
    // Notification Preferences
    notificationPreferences: {
        email: {
            type: Boolean,
            default: true
        },
        sms: {
            type: Boolean,
            default: false
        },
        push: {
            type: Boolean,
            default: true
        },
        slack: {
            type: Boolean,
            default: false
        },
        visitorArrival: {
            type: Boolean,
            default: true
        },
        approvalRequests: {
            type: Boolean,
            default: true
        },
        securityAlerts: {
            type: Boolean,
            default: true
        }
    },
    
    // Contact Information
    officeLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    officePhone: {
        type: String,
        trim: true
    },
    officeExtension: {
        type: String,
        trim: true
    },
    
    // Security Settings
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String
    },
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    
    // API Access
    apiKey: {
        type: String,
        unique: true,
        sparse: true
    },
    apiEnabled: {
        type: Boolean,
        default: false
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Preferences
    language: {
        type: String,
        default: 'en'
    },
    dateFormat: {
        type: String,
        default: 'MM/DD/YYYY'
    },
    timeFormat: {
        type: String,
        enum: ['12h', '24h'],
        default: '12h'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ organization: 1, role: 1 });
userSchema.index({ employeeId: 1 });
userSchema.index({ apiKey: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate API key
userSchema.methods.generateApiKey = function() {
    const crypto = require('crypto');
    this.apiKey = crypto.randomBytes(32).toString('hex');
    return this.apiKey;
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { loginAttempts: 1, lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
    }
    
    return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
    });
};

// Static methods
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByApiKey = function(apiKey) {
    return this.findOne({ apiKey, apiEnabled: true, isActive: true });
};

userSchema.statics.getHosts = function(organizationId) {
    return this.find({
        organization: organizationId,
        role: { $in: ['employee', 'host', 'admin'] },
        isActive: true
    }).select('firstName lastName email department position employeeId');
};

module.exports = mongoose.model('User', userSchema);



