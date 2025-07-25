import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';
import { Loan } from '../models/Loan';
import { authenticateToken, AuthRequest, adminOnly } from '../middleware/auth';

const router = express.Router();

// All admin routes require admin authentication
router.use(authenticateToken, adminOnly);

// @route   PATCH /api/admin/loans/:id/approve
// @desc    Approve or reject verified loan
// @access  Private (Admin only)
router.patch('/loans/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
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

    const loan = await Loan.findById(req.params.id);

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

    const updateData: any = {
      approvedBy: req.user?._id,
      approvalDate: new Date(),
    };

    if (action === 'approve') {
      updateData.status = 'approved';
    } else {
      updateData.status = 'rejected';
      updateData.rejectionReason = rejectionReason;
    }

    const updatedLoan = await Loan.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('verifiedBy', 'name email')
     .populate('approvedBy', 'name email');

    res.json({
      success: true,
      message: `Loan ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      data: { loan: updatedLoan },
    });
  } catch (error) {
    console.error('Approve loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during loan approval',
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { role, search, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    let query: any = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await User.countDocuments(query);

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
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
    });
  }
});

// @route   POST /api/admin/users
// @desc    Create new user
// @access  Private (Admin only)
const createUserValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('role').isIn(['admin', 'verifier']).withMessage('Role must be admin or verifier'),
];

router.post('/users', createUserValidation, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { email, password, name, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
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
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user creation',
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (deactivate)
// @access  Private (Admin only)
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user?._id?.toString()) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Deactivate instead of delete to maintain data integrity
    await User.findByIdAndUpdate(userId, { isActive: false });

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user deletion',
    });
  }
});

// @route   PATCH /api/admin/users/:id/activate
// @desc    Activate/deactivate user
// @access  Private (Admin only)
router.patch('/users/:id/activate', async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Prevent admin from deactivating themselves
    if (userId === req.user?._id?.toString() && !isActive) {
      res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account',
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');

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
  } catch (error) {
    console.error('Activate/deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user activation',
    });
  }
});

export default router;
