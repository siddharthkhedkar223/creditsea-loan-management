"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const Loan_1 = require("../models/Loan");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const loanValidation = [
    (0, express_validator_1.body)('applicantName').trim().isLength({ min: 2 }).withMessage('Applicant name must be at least 2 characters'),
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('phoneNumber').trim().isLength({ min: 10 }).withMessage('Valid phone number is required'),
    (0, express_validator_1.body)('loanAmount').isFloat({ min: 1000, max: 10000000 }).withMessage('Loan amount must be between 1,000 and 10,000,000'),
    (0, express_validator_1.body)('loanPurpose').trim().isLength({ min: 5 }).withMessage('Loan purpose must be at least 5 characters'),
    (0, express_validator_1.body)('employmentStatus').isIn(['employed', 'self-employed', 'unemployed', 'retired']).withMessage('Invalid employment status'),
    (0, express_validator_1.body)('monthlyIncome').isFloat({ min: 0 }).withMessage('Monthly income must be a positive number'),
];
router.post('/apply', loanValidation, async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array(),
            });
            return;
        }
        const { applicantName, email, phoneNumber, loanAmount, loanPurpose, employmentStatus, monthlyIncome, creditScore, documents, } = req.body;
        const existingApplication = await Loan_1.Loan.findOne({
            email,
            status: { $in: ['pending', 'verified'] },
        });
        if (existingApplication) {
            res.status(400).json({
                success: false,
                message: 'You already have a pending loan application',
            });
            return;
        }
        const loan = new Loan_1.Loan({
            applicantName,
            email,
            phoneNumber,
            loanAmount,
            loanPurpose,
            employmentStatus,
            monthlyIncome,
            creditScore,
            documents: documents || {},
        });
        await loan.save();
        res.status(201).json({
            success: true,
            message: 'Loan application submitted successfully',
            data: {
                loanId: loan._id,
                status: loan.status,
            },
        });
    }
    catch (error) {
        console.error('Loan application error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during loan application',
        });
    }
});
router.get('/', auth_1.authenticateToken, auth_1.verifierOrAdmin, async (req, res) => {
    try {
        const { status, page = '1', limit = '10', search } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { applicantName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phoneNumber: { $regex: search, $options: 'i' } },
            ];
        }
        if (req.user?.role === 'verifier') {
            query.status = 'pending';
        }
        const loans = await Loan_1.Loan.find(query)
            .populate('verifiedBy', 'name email')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);
        const total = await Loan_1.Loan.countDocuments(query);
        res.json({
            success: true,
            data: {
                loans,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum),
                },
            },
        });
    }
    catch (error) {
        console.error('Get loans error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching loans',
        });
    }
});
router.get('/:id', auth_1.authenticateToken, auth_1.verifierOrAdmin, async (req, res) => {
    try {
        const loan = await Loan_1.Loan.findById(req.params.id)
            .populate('verifiedBy', 'name email')
            .populate('approvedBy', 'name email');
        if (!loan) {
            res.status(404).json({
                success: false,
                message: 'Loan not found',
            });
            return;
        }
        if (req.user?.role === 'verifier' && loan.status !== 'pending') {
            res.status(403).json({
                success: false,
                message: 'Access denied',
            });
            return;
        }
        res.json({
            success: true,
            data: { loan },
        });
    }
    catch (error) {
        console.error('Get loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching loan',
        });
    }
});
router.patch('/:id/verify', auth_1.authenticateToken, auth_1.verifierOrAdmin, async (req, res) => {
    try {
        const { action, rejectionReason } = req.body;
        if (!['verify', 'reject'].includes(action)) {
            res.status(400).json({
                success: false,
                message: 'Action must be either "verify" or "reject"',
            });
            return;
        }
        if (action === 'reject' && !rejectionReason) {
            res.status(400).json({
                success: false,
                message: 'Rejection reason is required',
            });
            return;
        }
        const loan = await Loan_1.Loan.findById(req.params.id);
        if (!loan) {
            res.status(404).json({
                success: false,
                message: 'Loan not found',
            });
            return;
        }
        if (loan.status !== 'pending') {
            res.status(400).json({
                success: false,
                message: 'Only pending loans can be verified or rejected',
            });
            return;
        }
        const updateData = {
            verifiedBy: req.user?._id,
            verificationDate: new Date(),
        };
        if (action === 'verify') {
            updateData.status = 'verified';
        }
        else {
            updateData.status = 'rejected';
            updateData.rejectionReason = rejectionReason;
        }
        const updatedLoan = await Loan_1.Loan.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('verifiedBy', 'name email');
        res.json({
            success: true,
            message: `Loan ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
            data: { loan: updatedLoan },
        });
    }
    catch (error) {
        console.error('Verify loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during loan verification',
        });
    }
});
exports.default = router;
//# sourceMappingURL=loans.js.map