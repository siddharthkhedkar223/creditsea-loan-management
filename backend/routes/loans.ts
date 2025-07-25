import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Loan } from '../models/Loan';
import { authenticateToken, AuthRequest, verifierOrAdmin } from '../middleware/auth';

const router = express.Router();

// Loan application validation rules
const loanValidation = [
  body('applicantName').trim().isLength({ min: 2 }).withMessage('Applicant name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phoneNumber').trim().isLength({ min: 10 }).withMessage('Valid phone number is required'),
  body('loanAmount').isFloat({ min: 1000, max: 10000000 }).withMessage('Loan amount must be between 1,000 and 10,000,000'),
  body('loanPurpose').trim().isLength({ min: 5 }).withMessage('Loan purpose must be at least 5 characters'),
  body('employmentStatus').isIn(['employed', 'self-employed', 'unemployed', 'retired']).withMessage('Invalid employment status'),
  body('monthlyIncome').isFloat({ min: 0 }).withMessage('Monthly income must be a positive number'),
];

// @route   POST /api/loans/apply
// @desc    Submit loan application
// @access  Public
router.post('/apply', loanValidation, async (req: Request, res: Response): Promise<void> => {
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

    const {
      applicantName,
      email,
      phoneNumber,
      loanAmount,
      loanPurpose,
      employmentStatus,
      monthlyIncome,
      creditScore,
      documents,
    } = req.body;

    // Check for existing pending application
    const existingApplication = await Loan.findOne({
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

    const loan = new Loan({
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
  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during loan application',
    });
  }
});

// @route   GET /api/loans
// @desc    Get loans (filtered by role)
// @access  Private (Verifier/Admin)
router.get('/', authenticateToken, verifierOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = '1', limit = '10', search } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query: any = {};
    
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

    // Role-based filtering
    if (req.user?.role === 'verifier') {
      // Verifiers can only see pending applications
      query.status = 'pending';
    }

    const loans = await Loan.find(query)
      .populate('verifiedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Loan.countDocuments(query);

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
  } catch (error) {
    console.error('Get loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loans',
    });
  }
});

// @route   GET /api/loans/:id
// @desc    Get single loan
// @access  Private (Verifier/Admin)
router.get('/:id', authenticateToken, verifierOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('verifiedBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!loan) {
      res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
      return;
    }

    // Role-based access control
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
  } catch (error) {
    console.error('Get loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching loan',
    });
  }
});

// @route   PATCH /api/loans/:id/verify
// @desc    Verify or reject loan application
// @access  Private (Verifier/Admin)
router.patch('/:id/verify', authenticateToken, verifierOrAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
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

    const loan = await Loan.findById(req.params.id);

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

    const updateData: any = {
      verifiedBy: req.user?._id,
      verificationDate: new Date(),
    };

    if (action === 'verify') {
      updateData.status = 'verified';
    } else {
      updateData.status = 'rejected';
      updateData.rejectionReason = rejectionReason;
    }

    const updatedLoan = await Loan.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('verifiedBy', 'name email');

    res.json({
      success: true,
      message: `Loan ${action === 'verify' ? 'verified' : 'rejected'} successfully`,
      data: { loan: updatedLoan },
    });
  } catch (error) {
    console.error('Verify loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during loan verification',
    });
  }
});

export default router;
