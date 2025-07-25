"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Loan = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const loanSchema = new mongoose_1.Schema({
    applicantName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true,
    },
    loanAmount: {
        type: Number,
        required: true,
        min: 1000,
        max: 10000000,
    },
    loanPurpose: {
        type: String,
        required: true,
        trim: true,
    },
    employmentStatus: {
        type: String,
        required: true,
        enum: ['employed', 'self-employed', 'unemployed', 'retired'],
    },
    monthlyIncome: {
        type: Number,
        required: true,
        min: 0,
    },
    creditScore: {
        type: Number,
        min: 300,
        max: 850,
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'approved', 'rejected'],
        default: 'pending',
    },
    verifiedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    approvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    verificationDate: {
        type: Date,
    },
    approvalDate: {
        type: Date,
    },
    rejectionReason: {
        type: String,
        trim: true,
    },
    documents: {
        idProof: String,
        incomeProof: String,
        addressProof: String,
    },
}, {
    timestamps: true,
});
loanSchema.index({ status: 1 });
loanSchema.index({ email: 1 });
loanSchema.index({ createdAt: -1 });
loanSchema.index({ verifiedBy: 1 });
loanSchema.index({ approvedBy: 1 });
exports.Loan = mongoose_1.default.model('Loan', loanSchema);
//# sourceMappingURL=Loan.js.map