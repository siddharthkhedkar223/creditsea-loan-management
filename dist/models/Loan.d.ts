import mongoose, { Document } from 'mongoose';
export type LoanStatus = 'pending' | 'verified' | 'approved' | 'rejected';
export interface ILoan extends Document {
    applicantName: string;
    email: string;
    phoneNumber: string;
    loanAmount: number;
    loanPurpose: string;
    employmentStatus: string;
    monthlyIncome: number;
    creditScore?: number;
    status: LoanStatus;
    verifiedBy?: mongoose.Types.ObjectId;
    approvedBy?: mongoose.Types.ObjectId;
    verificationDate?: Date;
    approvalDate?: Date;
    rejectionReason?: string;
    documents: {
        idProof?: string;
        incomeProof?: string;
        addressProof?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const Loan: mongoose.Model<ILoan, {}, {}, {}, mongoose.Document<unknown, {}, ILoan, {}> & ILoan & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Loan.d.ts.map