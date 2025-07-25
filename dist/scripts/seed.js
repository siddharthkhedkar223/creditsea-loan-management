"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = require("../models/User");
const Loan_1 = require("../models/Loan");
dotenv_1.default.config();
const seedDatabase = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not defined');
        }
        await mongoose_1.default.connect(mongoURI);
        console.log('Connected to MongoDB Atlas');
        await User_1.User.deleteMany({});
        await Loan_1.Loan.deleteMany({});
        console.log('Cleared existing data');
        const saltRounds = 12;
        const adminPassword = await bcryptjs_1.default.hash('admin123', saltRounds);
        const verifierPassword = await bcryptjs_1.default.hash('verifier123', saltRounds);
        const admin = new User_1.User({
            email: 'admin@creditsea.com',
            password: adminPassword,
            name: 'System Administrator',
            role: 'admin',
        });
        const verifier = new User_1.User({
            email: 'verifier@creditsea.com',
            password: verifierPassword,
            name: 'Loan Verifier',
            role: 'verifier',
        });
        await admin.save();
        await verifier.save();
        console.log('Created sample users');
        const sampleLoans = [
            {
                applicantName: 'John Doe',
                email: 'john.doe@example.com',
                phoneNumber: '+1234567890',
                loanAmount: 50000,
                loanPurpose: 'Home renovation',
                employmentStatus: 'employed',
                monthlyIncome: 8000,
                creditScore: 720,
                status: 'pending',
            },
            {
                applicantName: 'Jane Smith',
                email: 'jane.smith@example.com',
                phoneNumber: '+1234567891',
                loanAmount: 25000,
                loanPurpose: 'Education',
                employmentStatus: 'employed',
                monthlyIncome: 6000,
                creditScore: 680,
                status: 'verified',
                verifiedBy: verifier._id,
                verificationDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
            {
                applicantName: 'Bob Johnson',
                email: 'bob.johnson@example.com',
                phoneNumber: '+1234567892',
                loanAmount: 75000,
                loanPurpose: 'Business expansion',
                employmentStatus: 'self-employed',
                monthlyIncome: 12000,
                creditScore: 750,
                status: 'approved',
                verifiedBy: verifier._id,
                approvedBy: admin._id,
                verificationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                approvalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            },
            {
                applicantName: 'Alice Brown',
                email: 'alice.brown@example.com',
                phoneNumber: '+1234567893',
                loanAmount: 15000,
                loanPurpose: 'Medical expenses',
                employmentStatus: 'employed',
                monthlyIncome: 4500,
                creditScore: 620,
                status: 'rejected',
                verifiedBy: verifier._id,
                verificationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                rejectionReason: 'Insufficient income for requested loan amount',
            },
            {
                applicantName: 'Charlie Wilson',
                email: 'charlie.wilson@example.com',
                phoneNumber: '+1234567894',
                loanAmount: 30000,
                loanPurpose: 'Debt consolidation',
                employmentStatus: 'employed',
                monthlyIncome: 7000,
                creditScore: 700,
                status: 'pending',
            },
        ];
        for (const loanData of sampleLoans) {
            const loan = new Loan_1.Loan(loanData);
            await loan.save();
        }
        console.log('Created sample loan applications');
        console.log('\n=== SEED DATA SUMMARY ===');
        console.log('Admin User:');
        console.log('  Email: admin@creditsea.com');
        console.log('  Password: admin123');
        console.log('\nVerifier User:');
        console.log('  Email: verifier@creditsea.com');
        console.log('  Password: verifier123');
        console.log('\nSample loan applications created with various statuses');
        console.log('========================\n');
        await mongoose_1.default.disconnect();
        console.log('Database seeded successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};
if (require.main === module) {
    seedDatabase();
}
exports.default = seedDatabase;
//# sourceMappingURL=seed.js.map