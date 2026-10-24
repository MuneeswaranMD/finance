import { Transaction, Invoice, Loan, LoanInstallment } from '../types/finance';

function downloadCSVFile(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportTransactionsToCSV(transactions: Transaction[]) {
  const headers = ['ID', 'Date', 'Type', 'Amount (INR)', 'Category', 'Account', 'Description', 'Tags', 'Idempotency Key'];
  const rows = transactions.map((t) => [
    `"${t.id}"`,
    `"${t.date}"`,
    `"${t.type}"`,
    t.amount,
    `"${t.category}"`,
    `"${t.account}"`,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    `"${(t.tags || []).join('; ')}"`,
    `"${t.idempotencyKey || ''}"`
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSVFile(csv, `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportInvoicesToCSV(invoices: Invoice[]) {
  const headers = [
    'Invoice Number',
    'Client Name',
    'Issue Date',
    'Due Date',
    'Status',
    'Subtotal (INR)',
    'Tax (INR)',
    'Total Amount (INR)',
    'Paid Amount (INR)',
    'Balance (INR)'
  ];

  const rows = invoices.map((inv) => [
    `"${inv.invoiceNumber}"`,
    `"${inv.clientName.replace(/"/g, '""')}"`,
    `"${inv.issueDate}"`,
    `"${inv.dueDate}"`,
    `"${inv.status}"`,
    inv.subtotal,
    inv.taxAmount,
    inv.totalAmount,
    inv.paidAmount,
    inv.remainingBalance
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  downloadCSVFile(csv, `invoices_export_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportLoanScheduleToCSV(loan: Loan, installments: LoanInstallment[]) {
  const headers = [
    'Installment #',
    'Due Date',
    'Status',
    'Total EMI (INR)',
    'Principal Component (INR)',
    'Interest Component (INR)',
    'Remaining Balance (INR)'
  ];

  const rows = installments.map((inst) => [
    inst.installmentNumber,
    `"${inst.dueDate}"`,
    `"${inst.status}"`,
    inst.totalEMI,
    inst.principalComponent,
    inst.interestComponent,
    inst.remainingBalanceAfter
  ]);

  const csv = [
    `"Loan: ${loan.title} (${loan.counterparty}) - Principal: INR ${loan.principalAmount} - Rate: ${loan.annualInterestRate}%"`,
    headers.join(','),
    ...rows.map((r) => r.join(','))
  ].join('\r\n');

  downloadCSVFile(csv, `loan_schedule_${loan.title.replace(/\s+/g, '_')}.csv`);
}
