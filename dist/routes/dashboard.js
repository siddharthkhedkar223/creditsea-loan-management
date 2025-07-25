"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Loan_1 = require("../models/Loan");
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateToken);
router.get('/stats', async (req, res) => {
    try {
        const userRole = req.user?.role;
        const totalLoans = await Loan_1.Loan.countDocuments();
        const pendingLoans = await Loan_1.Loan.countDocuments({ status: 'pending' });
        const verifiedLoans = await Loan_1.Loan.countDocuments({ status: 'verified' });
        const approvedLoans = await Loan_1.Loan.countDocuments({ status: 'approved' });
        const rejectedLoans = await Loan_1.Loan.countDocuments({ status: 'rejected' });
        const totalLoanAmount = await Loan_1.Loan.aggregate([
            { $group: { _id: null, total: { $sum: '$loanAmount' } } }
        ]);
        const approvedLoanAmount = await Loan_1.Loan.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$loanAmount' } } }
        ]);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentApplications = await Loan_1.Loan.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });
        let userStats = null;
        if (userRole === 'admin') {
            const totalUsers = await User_1.User.countDocuments();
            const activeUsers = await User_1.User.countDocuments({ isActive: true });
            const adminUsers = await User_1.User.countDocuments({ role: 'admin', isActive: true });
            const verifierUsers = await User_1.User.countDocuments({ role: 'verifier', isActive: true });
            userStats = {
                total: totalUsers,
                active: activeUsers,
                admins: adminUsers,
                verifiers: verifierUsers,
            };
        }
        const statusDistribution = [
            { status: 'pending', count: pendingLoans, percentage: (pendingLoans / totalLoans * 100).toFixed(1) },
            { status: 'verified', count: verifiedLoans, percentage: (verifiedLoans / totalLoans * 100).toFixed(1) },
            { status: 'approved', count: approvedLoans, percentage: (approvedLoans / totalLoans * 100).toFixed(1) },
            { status: 'rejected', count: rejectedLoans, percentage: (rejectedLoans / totalLoans * 100).toFixed(1) },
        ];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const monthlyTrends = await Loan_1.Loan.aggregate([
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
    }
    catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard statistics',
        });
    }
});
router.get('/recent-loans', async (req, res) => {
    try {
        const { limit = '10' } = req.query;
        const limitNum = parseInt(limit);
        let query = {};
        if (req.user?.role === 'verifier') {
            query.status = 'pending';
        }
        const recentLoans = await Loan_1.Loan.find(query)
            .populate('verifiedBy', 'name')
            .populate('approvedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .select('applicantName email loanAmount status createdAt verificationDate approvalDate');
        res.json({
            success: true,
            data: { loans: recentLoans },
        });
    }
    catch (error) {
        console.error('Recent loans error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching recent loans',
        });
    }
});
router.get('/my-activity', async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRole = req.user?.role;
        let activity = {};
        if (userRole === 'verifier') {
            const verificationsToday = await Loan_1.Loan.countDocuments({
                verifiedBy: userId,
                verificationDate: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            });
            const totalVerifications = await Loan_1.Loan.countDocuments({
                verifiedBy: userId
            });
            const pendingCount = await Loan_1.Loan.countDocuments({
                status: 'pending'
            });
            activity = {
                verificationsToday,
                totalVerifications,
                pendingVerifications: pendingCount,
            };
        }
        else if (userRole === 'admin') {
            const approvalsToday = await Loan_1.Loan.countDocuments({
                approvedBy: userId,
                approvalDate: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            });
            const totalApprovals = await Loan_1.Loan.countDocuments({
                approvedBy: userId
            });
            const pendingApprovals = await Loan_1.Loan.countDocuments({
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
    }
    catch (error) {
        console.error('User activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user activity',
        });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map