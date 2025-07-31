


const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
    visitorId: {
        type: String,
        unique: true,
        required: true,
        default: () => 'VIS' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase()
    },
    
    // Personal Information
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
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: String,
        trim: true
    },
    designation: {
        type: String,
        trim: true
    },
    
    // Identification
    idType: {
        type: String,
        enum: ['passport', 'drivers_license', 'national_id', 'employee_id'],
        required: true
    },
    idNumber: {
        type: String,
        required: true,
        trim: true
    },
    idPhoto: {
        type: String // URL to stored ID photo
    },
    
    // Visit Details
    purpose: {
        type: String,
        required: true,
        enum: ['meeting', 'interview', 'delivery', 'maintenance', 'tour', 'other']
    },
    purposeDescription: {
        type: String,
        trim: true
    },
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expectedArrival: {
        type: Date,
        required: true
    },
    expectedDeparture: {
        type: Date
    },
    
    // Approval Workflow
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'auto_approved'],
        default: 'pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    
    // Check-in/Check-out
    checkInTime: {
        type: Date
    },
    checkOutTime: {
        type: Date
    },
    actualDeparture: {
        type: Date
    },
    
    // Security & Compliance
    securityClearance: {
        type: String,
        enum: ['basic', 'elevated', 'restricted'],
        default: 'basic'
    },
    backgroundCheck: {
        type: String,
        enum: ['pending', 'cleared', 'flagged'],
        default: 'pending'
    },
    securityFlags: [{
        type: String,
        enum: ['watchlist', 'suspicious', 'restricted_area', 'photo_mismatch']
    }],
    
    // Location & Access
    location: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true
    },
    accessAreas: [{
        type: String
    }],
    badgeNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // QR Code & NFC
    qrCode: {
        type: String, // Generated QR code data
        unique: true
    },
    nfcTag: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // Photos
    photo: {
        type: String // URL to visitor photo
    },
    checkInPhoto: {
        type: String // Photo taken at check-in
    },
    
    // Emergency Contact
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    
    // Vehicle Information
    vehicle: {
        make: String,
        model: String,
        color: String,
        licensePlate: String,
        parkingSpot: String
    },
    
    // Preferences & Notes
    accessibilityNeeds: {
        type: String,
        trim: true
    },
    dietaryRestrictions: {
        type: String,
        trim: true
    },
    specialInstructions: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    
    // Analytics
    visitDuration: {
        type: Number // in minutes
    },
    satisfactionRating: {
        type: Number,
        min: 1,
        max: 5
    },
    
    // Organization
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['scheduled', 'checked_in', 'checked_out', 'cancelled', 'no_show'],
        default: 'scheduled'
    },
    
    // Notifications sent
    notifications: [{
        type: {
            type: String,
            enum: ['email', 'sms', 'push', 'slack']
        },
        sentAt: Date,
        status: {
            type: String,
            enum: ['sent', 'delivered', 'failed']
        }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
visitorSchema.index({ visitorId: 1 });
visitorSchema.index({ email: 1, organization: 1 });
visitorSchema.index({ host: 1, expectedArrival: 1 });
visitorSchema.index({ organization: 1, status: 1 });
visitorSchema.index({ checkInTime: 1 });
visitorSchema.index({ createdAt: -1 });

// Virtual for full name
visitorSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Virtual for visit status
visitorSchema.virtual('isOverdue').get(function() {
    return this.expectedArrival < new Date() && this.status === 'scheduled';
});

// Virtual for current status
visitorSchema.virtual('currentStatus').get(function() {
    if (this.checkOutTime) return 'completed';
    if (this.checkInTime) return 'on_premises';
    if (this.status === 'cancelled') return 'cancelled';
    if (this.isOverdue) return 'overdue';
    return 'scheduled';
});

// Pre-save middleware
visitorSchema.pre('save', function(next) {
    // Generate QR code if not exists
    if (!this.qrCode) {
        this.qrCode = `VP-${this.visitorId}-${Date.now()}`;
    }
    
    // Calculate visit duration on checkout
    if (this.checkInTime && this.checkOutTime && !this.visitDuration) {
        this.visitDuration = Math.round((this.checkOutTime - this.checkInTime) / (1000 * 60));
    }
    
    next();
});

// Static methods
visitorSchema.statics.getTodayVisitors = function(organizationId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.find({
        organization: organizationId,
        expectedArrival: {
            $gte: today,
            $lt: tomorrow
        }
    });
};

visitorSchema.statics.getAnalytics = function(organizationId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                organization: organizationId,
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
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
                avgVisitDuration: { $avg: '$visitDuration' },
                approvalRate: {
                    $avg: {
                        $cond: [{ $eq: ['$approvalStatus', 'approved'] }, 1, 0]
                    }
                }
            }
        }
    ]);
};

module.exports = mongoose.model('Visitor', visitorSchema);



