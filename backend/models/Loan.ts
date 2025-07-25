import mongoose, { Document, Schema } from 'mongoose';

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

const loanSchema = new Schema<ILoan>({
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
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
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

// Indexes for performance
loanSchema.index({ status: 1 });
loanSchema.index({ email: 1 });
loanSchema.index({ createdAt: -1 });
loanSchema.index({ verifiedBy: 1 });
loanSchema.index({ approvedBy: 1 });

export const Loan = mongoose.model<ILoan>('Loan', loanSchema);
