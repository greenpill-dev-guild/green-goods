import type { Address } from "../../types/domain";
import type { CreditPoolStats, Loan, LoanPrincipalRelationship } from "./types-credit";
import {
  type RawRow,
  address,
  hexString,
  integer,
  number,
  optionalInteger,
  optionalNumber,
  queryRows,
  string,
} from "./data-core";

const LOAN_FIELDS = /* GraphQL */ `
  id chainId loanId creditRegistry poolId garden borrower requestedBy recordedBy commitmentId token
  principal repaidAmount outstanding feeAmount rail disbursementId state dueDate installmentsTotal
  installmentsPaid attempts executionRef termsCID reasonCID defaultReasonCID recoveredFromDefault
  defaultedAt settlementRelationshipEntityId createdAt updatedAt
`;

function mapLoan(row: RawRow): Loan {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    loanId: integer(row.loanId),
    creditRegistry: address(row.creditRegistry) ?? undefined,
    poolId: integer(row.poolId),
    garden: address(row.garden)!,
    borrower: address(row.borrower)!,
    requestedBy: address(row.requestedBy)!,
    recordedBy: address(row.recordedBy)!,
    commitmentId: optionalInteger(row.commitmentId),
    token: address(row.token)!,
    principal: integer(row.principal),
    repaidAmount: integer(row.repaidAmount),
    outstanding: integer(row.outstanding),
    feeAmount: integer(row.feeAmount),
    rail: String(row.rail) as Loan["rail"],
    disbursementId: optionalInteger(row.disbursementId),
    state: String(row.state) as Loan["state"],
    dueDate: integer(row.dueDate),
    installmentsTotal: number(row.installmentsTotal),
    installmentsPaid: number(row.installmentsPaid),
    attempts: optionalNumber(row.attempts),
    executionRef: hexString(row.executionRef),
    termsCID: String(row.termsCID),
    reasonCID: string(row.reasonCID),
    defaultReasonCID: string(row.defaultReasonCID),
    recoveredFromDefault: row.recoveredFromDefault === true,
    defaultedAt: optionalNumber(row.defaultedAt),
    settlementRelationshipEntityId: string(row.settlementRelationshipEntityId),
    createdAt: number(row.createdAt),
    updatedAt: number(row.updatedAt),
  };
}

function mapCreditPoolStats(row: RawRow): CreditPoolStats {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    poolId: integer(row.poolId),
    garden: address(row.garden)!,
    token: address(row.token),
    borrowerCap: integer(row.borrowerCap),
    enabled: row.enabled === true,
    creditIssued: integer(row.creditIssued),
    creditRepaid: integer(row.creditRepaid),
    creditOutstanding: integer(row.creditOutstanding),
    repaymentRateNumerator: integer(row.repaymentRateNumerator),
    repaymentRateDenominator: integer(row.repaymentRateDenominator),
    defaultRateNumerator: integer(row.defaultRateNumerator),
    defaultRateDenominator: integer(row.defaultRateDenominator),
    updatedAt: number(row.updatedAt),
  };
}

function mapLoanPrincipalRelationship(row: RawRow): LoanPrincipalRelationship {
  return {
    id: String(row.id),
    chainId: number(row.chainId),
    disbursementId: integer(row.disbursementId),
    creditRegistry: address(row.creditRegistry)!,
    loanId: integer(row.loanId),
    updatedAt: number(row.updatedAt),
  };
}

export async function getCreditLoan(chainId: number, loanId: bigint): Promise<Loan | null> {
  const id = `${chainId}-${loanId}`;
  const query = `query CreditLoan($id: String!) { Loan(where: { id: { _eq: $id } }, limit: 1) { ${LOAN_FIELDS} } }`;
  const row = (await queryRows(query, { id }, "Loan", "getCreditLoan"))[0];
  return row ? mapLoan(row) : null;
}

export async function getCreditLoansForSubject(
  chainId: number,
  poolId: bigint,
  subject: Address
): Promise<Loan[]> {
  const borrower = subject.toLowerCase();
  const query = `query CreditLoansForSubject($chainId: Int!, $poolId: numeric!, $borrower: String!) {
    Loan(
      where: { chainId: { _eq: $chainId }, poolId: { _eq: $poolId }, borrower: { _eq: $borrower } }
      order_by: { loanId: desc }
    ) { ${LOAN_FIELDS} }
  }`;
  return (
    await queryRows(
      query,
      { chainId, poolId: poolId.toString(), borrower },
      "Loan",
      "getCreditLoansForSubject"
    )
  ).map(mapLoan);
}

export async function getCreditPoolStats(
  chainId: number,
  poolId: bigint
): Promise<CreditPoolStats | null> {
  const id = `${chainId}-${poolId}`;
  const query = `query CreditPoolStats($id: String!) {
    CreditPoolStats(where: { id: { _eq: $id } }, limit: 1) {
      id chainId poolId garden token borrowerCap enabled creditIssued creditRepaid creditOutstanding
      repaymentRateNumerator repaymentRateDenominator defaultRateNumerator defaultRateDenominator updatedAt
    }
  }`;
  const row = (await queryRows(query, { id }, "CreditPoolStats", "getCreditPoolStats"))[0];
  return row ? mapCreditPoolStats(row) : null;
}

export async function getLoanPrincipalRelationship(
  chainId: number,
  disbursementId: bigint
): Promise<LoanPrincipalRelationship | null> {
  const id = `${chainId}-${disbursementId}`;
  const query = `query LoanPrincipalRelationship($id: String!) {
    LoanPrincipalRelationship(where: { id: { _eq: $id } }, limit: 1) {
      id chainId disbursementId creditRegistry loanId updatedAt
    }
  }`;
  const row = (
    await queryRows(query, { id }, "LoanPrincipalRelationship", "getLoanPrincipalRelationship")
  )[0];
  return row ? mapLoanPrincipalRelationship(row) : null;
}
