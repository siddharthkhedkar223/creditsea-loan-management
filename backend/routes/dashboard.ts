import express, { Response } from 'express';
import { Loan } from '../models/Loan';
import { User } from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// All dashboard routes require authentication
router.use(authenticateToken);

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;

    // Basic loan statistics
    const totalLoans = await Loan.countDocuments();
    const pendingLoans = await Loan.countDocuments({ status: 'pending' });
    const verifiedLoans = await Loan.countDocuments({ status: 'verified' });
    const approvedLoans = await Loan.countDocuments({ status: 'approved' });
    const rejectedLoans = await Loan.countDocuments({ status: 'rejected' });

    // Total loan amount statistics
    const totalLoanAmount = await Loan.aggregate([
      { $group: { _id: null, total: { $sum: '$loanAmount' } } }
    ]);

    const approvedLoanAmount = await Loan.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$loanAmount' } } }
    ]);

    // Recent applications (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentApplications = await Loan.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // User statistics (admin only)
    let userStats = null;
    if (userRole === 'admin') {
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ isActive: true });
      const adminUsers = await User.countDocuments({ role: 'admin', isActive: true });
      const verifierUsers = await User.countDocuments({ role: 'verifier', isActive: true });

      userStats = {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers,
        verifiers: verifierUsers,
      };
    }

    // Loan status distribution for charts
    const statusDistribution = [
      { status: 'pending', count: pendingLoans, percentage: (pendingLoans / totalLoans * 100).toFixed(1) },
      { status: 'verified', count: verifiedLoans, percentage: (verifiedLoans / totalLoans * 100).toFixed(1) },
      { status: 'approved', count: approvedLoans, percentage: (approvedLoans / totalLoans * 100).toFixed(1) },
      { status: 'rejected', count: rejectedLoans, percentage: (rejectedLoans / totalLoans * 100).toFixed(1) },
    ];

    // Monthly loan trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await Loan.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          applications: { $sum: 1 },
          totalAmount: { $sum: '$loanAmount' },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalLoans,
          pendingLoans,
          verifiedLoans,
          approvedLoans,
          rejectedLoans,
          recentApplications,
          totalLoanAmount: totalLoanAmount[0]?.total || 0,
          approvedLoanAmount: approvedLoanAmount[0]?.total || 0,
        },
        ...(userStats && { users: userStats }),
        statusDistribution,
        monthlyTrends,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard statistics',
    });
  }
});

// @route   GET /api/dashboard/recent-loans
// @desc    Get recent loan applications
// @access  Private
router.get('/recent-loans', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    let query: any = {};
    
    // Role-based filtering
    if (req.user?.role === 'verifier') {
      query.status = 'pending';
    }

    const recentLoans = await Loan.find(query)
      .populate('verifiedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .select('applicantName email loanAmount status createdAt verificationDate approvalDate');

    res.json({
      success: true,
      data: { loans: recentLoans },
    });
  } catch (error) {
    console.error('Recent loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recent loans',
    });
  }
});

// @route   GET /api/dashboard/my-activity
// @desc    Get current user's activity
// @access  Private
router.get('/my-activity', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;

    let activity: any = {};

    if (userRole === 'verifier') {
      // Verifier activity
      const verificationsToday = await Loan.countDocuments({
        verifiedBy: userId,
        verificationDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      const totalVerifications = await Loan.countDocuments({
        verifiedBy: userId
      });

      const pendingCount = await Loan.countDocuments({
        status: 'pending'
      });

      activity = {
        verificationsToday,
        totalVerifications,
        pendingVerifications: pendingCount,
      };
    } else if (userRole === 'admin') {
      // Admin activity
      const approvalsToday = await Loan.countDocuments({
        approvedBy: userId,
        approvalDate: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      const totalApprovals = await Loan.countDocuments({
        approvedBy: userId
      });

      const pendingApprovals = await Loan.countDocuments({
        status: 'verified'
      });

      activity = {
        approvalsToday,
        totalApprovals,
        pendingApprovals,
      };
    }

    res.json({
      success: true,
      data: { activity },
    });
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user activity',
    });
  }
});

export default router;
