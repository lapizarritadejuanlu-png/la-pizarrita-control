const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
const ctx={window:{},session:{user:{id:'owner'}},moves:[{move_type:'personal',move_date:'2026-08-01',amount:6265.72,payroll_run_id:'run'},{move_type:'personal',move_date:'2026-09-01',amount:110,category:'horas_extra'}],moreView:()=>'',bind:()=>{},loadData:async()=>{},api:async path=>path.includes('payroll_payments')?[{id:'payment',payroll_run_id:'run',paid_on:'2026-09-01',amount:5058.94}]:[{id:'run',period_start:'2026-08-01',net_total:5058.94}],console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('payroll-payments.js','utf8').replace('if(session)loadData();','globalThis.loadPaymentsTest=loadPayments;'),ctx);
assert.equal(ctx.window.personnelCashForMonth('2026-09'),null);
await ctx.loadPaymentsTest();assert.equal(ctx.window.personnelCashForMonth('2026-08'),0);assert.equal(ctx.window.personnelCashForMonth('2026-09'),5168.94);
assert.equal(ctx.moves[0].amount,6265.72); // Accrued salary cost unchanged.
ctx.api=async()=>{throw Error('offline')};await ctx.loadPaymentsTest();assert.equal(ctx.window.personnelCashForMonth('2026-09'),null);
const snapshotCode=fs.readFileSync('month-lock-business.js','utf8').split('function mlbFriendlyLockedError')[0]+'globalThis.snapshotTest=mlbBusinessSnapshot;})();';
ctx.invoices=[];ctx.window.personnelCashForMonth=()=>5168.94;vm.runInContext(snapshotCode,ctx);const snapshot=ctx.snapshotTest('2026-09');assert.equal(snapshot.personal_total,110);assert.equal(snapshot.result_estimate,-110);assert.equal(snapshot.cash_out_total,5168.94);
ctx.window.personnelCashForMonth=()=>null;assert.throws(()=>ctx.snapshotTest('2026-09'),/No se han cargado/);
console.log('PASS: August cost unchanged; September cash includes net payroll once plus overtime; failed loading blocks close.');
})().catch(e=>{console.error(e);process.exit(1)});
