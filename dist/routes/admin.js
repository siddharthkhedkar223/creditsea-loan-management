"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_validator_1 = require("express-validator");
const User_1 = require("../models/User");
const Loan_1 = require("../models/Loan");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken, auth_1.adminOnly);
router.patch('/loans/:id/approve', async (req, res) => {
    try {
        const { action, rejectionReason } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            res.status(400).json({
                success: false,
                message: 'Action must be either "approve" or "reject"',
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
        if (loan.status !== 'verified') {
            res.status(400).json({
                success: false,
                message: 'Only verified loans can be approved or rejected',
            });
            return;
        }
        const updateData = {
            approvedBy: req.user?._id,
            approvalDate: new Date(),
        };
        if (action === 'approve') {
            updateData.status = 'approved';
        }
        else {
            updateData.status = 'rejected';
            updateData.rejectionReason = rejectionReason;
        }
        const updatedLoan = await Loan_1.Loan.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('verifiedBy', 'name email')
            .populate('approvedBy', 'name email');
        res.json({
            success: true,
            message: `Loan ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
            data: { loan: updatedLoan },
        });
    }
    catch (error) {
        console.error('Approve loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during loan approval',
        });
    }
});
router.get('/users', async (req, res) => {
    try {
        const { role, search, page = '1', limit = '10' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        let query = {};
        if (role && role !== 'all') {
            query.role = role;
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        const users = await User_1.User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);
        const total = await User_1.User.countDocuments(query);
        res.json({
            success: true,
            data: {
                users,
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
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching users',
        });
    }
});
const createUserValidation = [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    (0, express_validator_1.body)('role').isIn(['admin', 'verifier']).withMessage('Role must be admin or verifier'),
];
router.post('/users', createUserValidation, async (req, res) => {
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
        const { email, password, name, role } = req.body;
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'User already exists with this email',
            });
            return;
        }
        const saltRounds = 12;
        const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
        const user = new User_1.User({
            email,
            password: hashedPassword,
            name,
            role,
        });
        await user.save();
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isActive: user.isActive,
                },
            },
        });
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user creation',
        });
    }
});
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        if (userId === req.user?._id?.toString()) {
            res.status(400).json({
                success: false,
                message: 'Cannot delete your own account',
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }
        await User_1.User.findByIdAndUpdate(userId, { isActive: false });
        res.json({
            success: true,
            message: 'User deactivated successfully',
        });
    }
    catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user deletion',
        });
    }
});
router.patch('/users/:id/activate', async (req, res) => {
    try {
        const userId = req.params.id;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({
                success: false,
                message: 'isActive must be a boolean value',
            });
            return;
        }
        if (userId === req.user?._id?.toString() && !isActive) {
            res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account',
            });
            return;
        }
        const user = await User_1.User.findByIdAndUpdate(userId, { isActive }, { new: true }).select('-password');
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found',
            });
            return;
        }
        res.json({
            success: true,
            message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: { user },
        });
    }
    catch (error) {
        console.error('Activate/deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during user activation',
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map