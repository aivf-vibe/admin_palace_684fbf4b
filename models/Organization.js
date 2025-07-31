




const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
    orgId: {
        type: String,
        unique: true,
        required: true,
        default: () => 'ORG' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase()
    },
    
    // Basic Information
    name: {
        type: String,
        required: true,
        trim: true
    },
    displayName: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    
    // Contact Information
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    
    // Address
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    
    // Settings
    settings: {
        // Visitor Management
        visitorManagement: {
            autoApproval: {
                type: Boolean,
                default: false
            },
            approvalRequired: {
                type: Boolean,
                default: true
            },
            preRegistrationRequired: {
                type: Boolean,
                default: false
            },
            maxAdvanceBooking: {
                type: Number,
                default: 30 // days
            },
            checkInWindow: {
                type: Number,
                default: 60 // minutes
            }
        },
        
        // Security Settings
        security: {
            backgroundCheckRequired: {
                type: Boolean,
                default: true
            },
            photoRequired: {
                type: Boolean,
                default: true
            },
            idVerificationRequired: {
                type: Boolean,
                default: true
            },
            facialRecognitionEnabled: {
                type: Boolean,
                default: false
            },
            watchlistCheck: {
                type: Boolean,
                default: true
            }
        },
        
        // Notifications
        notifications: {
            hostNotification: {
                type: Boolean,
                default: true
            },
            securityNotification: {
                type: Boolean,
                default: true
            },
            visitorConfirmation: {
                type: Boolean,
                default: true
            },
            reminderTime: {
                type: Number,
                default: 30 // minutes before arrival
            }
        },
        
        // Branding
        branding: {
            logo: String,
            primaryColor: {
                type: String,
                default: '#6366f1'
            },
            secondaryColor: {
                type: String,
                default: '#f59e0b'
            },
            customCSS: String,
            welcomeMessage: {
                type: String,
                default: 'Welcome to our office!'
            }
        },
        
        // Integration Settings
        integrations: {
            slack: {
                enabled: {
                    type: Boolean,
                    default: false
                },
                webhookUrl: String,
                channel: String
            },
            teams: {
                enabled: {
                    type: Boolean,
                    default: false
                },
                webhookUrl: String
            },
            calendar: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                provider: {
                    type: String,
                    enum: ['google', 'microsoft', 'none'],
                    default: 'none'
                }
            },
            accessControl: {
                enabled: {
                    type: Boolean,
                    default: false
                },
                system: String,
                apiKey: String
            }
        }
    },
    
    // Subscription & Billing
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'professional', 'enterprise'],
            default: 'free'
        },
        status: {
            type: String,
            enum: ['active', 'trial', 'expired', 'cancelled'],
            default: 'trial'
        },
        trialEndDate: {
            type: Date,
            default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
        },
        subscriptionId: String, // Stripe/PayPal subscription ID
        billingEmail: String,
        billingAddress: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        }
    },
    
    // Features & Limits
    features: {
        maxUsers: {
            type: Number,
            default: 5
        },
        maxLocations: {
            type: Number,
            default: 1
        },
        maxVisitorsPerMonth: {
            type: Number,
            default: 100
        },
        storageLimit: {
            type: Number,
            default: 1024 // MB
        },
        apiAccess: {
            type: Boolean,
            default: false
        },
        customBranding: {
            type: Boolean,
            default: false
        },
        advancedAnalytics: {
            type: Boolean,
            default: false
        },
        prioritySupport: {
            type: Boolean,
            default: false
        }
    },
    
    // Usage Tracking
    usage: {
        totalVisitors: {
            type: Number,
            default: 0
        },
        totalUsers: {
            type: Number,
            default: 0
        },
        totalLocations: {
            type: Number,
            default: 0
        },
        storageUsed: {
            type: Number,
            default: 0
        },
        lastResetDate: {
            type: Date,
            default: Date.now
        }
    },
    
    // Security & Compliance
    security: {
        twoFactorRequired: {
            type: Boolean,
            default: false
        },
        ssoEnabled: {
            type: Boolean,
            default: false
        },
        ssoProvider: String,
        compliance: {
            gdpr: {
                type: Boolean,
                default: true
            },
            soc2: {
                type: Boolean,
                default: false
            },
            hipaa: {
                type: Boolean,
                default: false
            }
        }
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
organizationSchema.index({ orgId: 1 });
organizationSchema.index({ email: 1 });
organizationSchema.index({ 'subscription.plan': 1 });
organizationSchema.index({ isActive: 1 });

// Virtual for trial status
organizationSchema.virtual('isTrialActive').get(function() {
    return this.subscription.status === 'trial' && this.subscription.trialEndDate > new Date();
});

// Virtual for subscription limits
organizationSchema.virtual('subscriptionLimits').get(function() {
    const limits = {
        free: { users: 5, locations: 1, visitors: 100, storage: 1024 },
        basic: { users: 20, locations: 3, visitors: 1000, storage: 5120 },
        professional: { users: 100, locations: 10, visitors: 10000, storage: 51200 },
        enterprise: { users: Infinity, locations: Infinity, visitors: Infinity, storage: Infinity }
    };
    
    return limits[this.subscription.plan] || limits.free;
});

// Pre-save middleware
organizationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Static methods
organizationSchema.statics.findByOrgId = function(orgId) {
    return this.findOne({ orgId });
};

organizationSchema.statics.getActiveOrganizations = function() {
    return this.find({ isActive: true });
};

module.exports = mongoose.model('Organization', organizationSchema);




