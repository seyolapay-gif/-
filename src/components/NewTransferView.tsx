import React, { useState, useEffect } from 'react';
import { CashLine, Transfer, TransferType } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ProviderBadge, PROVIDER_CONFIG } from './ProviderBadge';
import { formatAmount } from '../utils/formatters';
import { 
  ArrowLeftRight, 
  Wallet, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  RotateCcw, 
  Send, 
  Loader2, 
  Info, 
  ShieldCheck,
  CreditCard,
  UserCheck,
  PhoneCall,
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  Banknote,
  Sparkles
} from 'lucide-react';

interface NewTransferViewProps {
  initialLineId?: string;
  initialMode?: 'transfer' | 'receive';
  onSuccess: (transfer: Transfer) => void;
  onPrintReceipt: (transfer: Transfer) => void;
}

export const NewTransferView: React.FC<NewTransferViewProps> = ({
  initialLineId,
  initialMode = 'transfer',
  onSuccess,
  onPrintReceipt,
}) => {
  const { user } = useAuth();
  const [lines, setLines] = useState<CashLine[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(true);

  // Operation Mode: Transfer Out vs Receive In
  const [operationMode, setOperationMode] = useState<'transfer' | 'receive'>(initialMode);

  // Form Fields
  const [transferType, setTransferType] = useState<TransferType>('cash_wallet');
  const [sourceLineId, setSourceLineId] = useState<string>('');
  const [recipientType, setRecipientType] = useState<'wallet' | 'bank_account'>('wallet');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [destinationBankOrWallet, setDestinationBankOrWallet] = useState('فودافون كاش');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('10');
  const [notes, setNotes] = useState('');
  const [destinationLineChoice, setDestinationLineChoice] = useState<string>('manual');
  const [overrideLimit, setOverrideLimit] = useState(false);

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdTransfer, setCreatedTransfer] = useState<Transfer | null>(null);

  useEffect(() => {
    setOperationMode(initialMode);
    if (initialMode === 'receive') {
      setFee('0');
      setDestinationBankOrWallet('إنستاباي / محفظة إلكترونية');
    }
  }, [initialMode]);

  useEffect(() => {
    loadLines();
  }, []);

  const isSourceCashWallet = (provider?: string) => {
    return provider === 'vodafone' || provider === 'vodafone_vip' || provider === 'orange' || provider === 'etisalat' || provider === 'we';
  };
  const isSourceInstaPay = (provider?: string) => {
    return provider === 'instapay';
  };
  const isSourceBank = (provider?: string) => {
    return provider === 'banque_misr' || provider === 'cib' || provider === 'nbe' || provider === 'banque_du_caire' || provider === 'alexbank' || provider === 'qnb';
  };

  const loadLines = async () => {
    setIsLoadingLines(true);
    try {
      const data = await api.getLines();
      setLines(data);
      let targetId = '';
      if (initialLineId && data.some((l) => l.id === initialLineId)) {
        targetId = initialLineId;
      } else if (data.length > 0 && !sourceLineId) {
        const active = data.find((l) => l.status === 'active') || data[0];
        targetId = active.id;
      }
      if (targetId) {
        setSourceLineId(targetId);
        const l = data.find((item) => item.id === targetId);
        if (l && operationMode === 'transfer') {
          syncDestinationForLine(l);
        }
      }
    } catch (err) {
      console.error('Failed to load lines for transfer:', err);
    } finally {
      setIsLoadingLines(false);
    }
  };

  const syncDestinationForLine = (line: CashLine) => {
    if (isSourceCashWallet(line.provider)) {
      setTransferType('cash_wallet');
      setRecipientType('wallet');
      const validCashDestinations = ['فودافون كاش', 'أورنج كاش', 'اتصالات كاش', 'وي باي', 'محفظة إلكترونية كاش أخرى'];
      if (!validCashDestinations.includes(destinationBankOrWallet)) {
        setDestinationBankOrWallet('فودافون كاش');
      }
    } else if (isSourceInstaPay(line.provider)) {
      setTransferType('cash_wallet');
      const validInstaDestinations = ['شبكة إنستاباي IPN', 'فودافون كاش', 'أورنج كاش', 'اتصالات كاش', 'وي باي', 'محفظة إلكترونية أخرى'];
      if (!validInstaDestinations.includes(destinationBankOrWallet)) {
        setDestinationBankOrWallet('شبكة إنستاباي IPN');
      }
    } else if (isSourceBank(line.provider)) {
      setTransferType('bank_transfer');
      setRecipientType('bank_account');
      if (destinationBankOrWallet === 'فودافون كاش') {
        setDestinationBankOrWallet('البنك الأهلي المصري');
      }
    }
  };

  const handleSourceLineChange = (newLineId: string) => {
    setSourceLineId(newLineId);
    const line = lines.find((l) => l.id === newLineId);
    if (line && operationMode === 'transfer') {
      syncDestinationForLine(line);
    }
  };

  const selectedLine = lines.find((l) => l.id === sourceLineId);

  // Filter destination lines: When source is electronic cash wallet (Vodafone, Orange, Etisalat, WE),
  // ONLY show other electronic cash wallets and HIDE InstaPay and all Banks!
  const allowedDestinationLines = lines.filter((l) => {
    if (l.id === sourceLineId) return false;
    if (isSourceCashWallet(selectedLine?.provider)) {
      return isSourceCashWallet(l.provider);
    }
    if (isSourceInstaPay(selectedLine?.provider)) {
      return isSourceCashWallet(l.provider) || isSourceInstaPay(l.provider);
    }
    return true;
  });

  const handleDestinationLineChoiceChange = (choice: string) => {
    setDestinationLineChoice(choice);
    if (choice === 'manual') {
      // Keep or reset for manual input
    } else {
      const target = lines.find((l) => l.id === choice);
      if (target) {
        setRecipientNumber(target.phoneNumber);
        setRecipientName(target.name);
        if (target.provider === 'vodafone' || target.provider === 'vodafone_vip') setDestinationBankOrWallet('فودافون كاش');
        else if (target.provider === 'orange') setDestinationBankOrWallet('أورنج كاش');
        else if (target.provider === 'etisalat') setDestinationBankOrWallet('اتصالات كاش');
        else if (target.provider === 'we') setDestinationBankOrWallet('وي باي');
        else if (target.provider === 'instapay') setDestinationBankOrWallet('شبكة إنستاباي IPN');
        else if (isSourceBank(target.provider)) setDestinationBankOrWallet(PROVIDER_CONFIG[target.provider]?.name || 'حساب بنكي');
      }
    }
  };

  // Auto fee calculation based on amount for transfers
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = Number(val);
    if (!isNaN(num) && num > 0) {
      if (operationMode === 'receive') {
        // Receiving can have 0 default fee or customer margin
        if (!fee) setFee('0');
      } else {
        // Egyptian market standard: ~5 EGP per 1000 EGP or min 5 EGP
        if (transferType === 'cash_wallet') {
          const computedFee = Math.max(5, Math.ceil(num * 0.005));
          setFee(computedFee.toString());
        } else if (transferType === 'bank_transfer') {
          const computedFee = Math.max(10, Math.ceil(num * 0.003));
          setFee(computedFee.toString());
        } else {
          setFee('0');
        }
      }
    }
  };

  // Quick preset amount buttons helper
  const handleAddQuickAmount = (val: number) => {
    const current = Number(amount) || 0;
    const next = current + val;
    handleAmountChange(next.toString());
  };

  // Handler for recipient/sender number: strictly allow English digits only, convert Arabic digits, no letters
  const handleRecipientNumberChange = (raw: string) => {
    // Convert Arabic numbers to English numbers
    const englishDigits = raw.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    
    // For receive mode or cash wallets, strictly digits only (0-9) - no letters whatsoever
    if (operationMode === 'receive' || isSourceCashWallet(selectedLine?.provider)) {
      const sanitized = englishDigits.replace(/[^\d]/g, '');
      setRecipientNumber(sanitized);
    } else {
      // In bank/InstaPay transfer, convert Arabic digits but allow English letters or valid payment symbols if IPA
      const sanitized = englishDigits.replace(/[^\w@.-]/g, '');
      setRecipientNumber(sanitized);
    }

    if (destinationLineChoice !== 'manual') {
      setDestinationLineChoice('manual');
    }
  };

  // Handler for customer/recipient name: ONLY allow Arabic or English letters and spaces, NO numbers!
  const handleRecipientNameChange = (raw: string) => {
    // Remove all numbers (both English 0-9 and Arabic ٠-٩)
    const withoutNumbers = raw.replace(/[\d٠-٩]/g, '');
    // Only allow Arabic letters, English letters, and spaces
    const lettersOnly = withoutNumbers.replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z\s]/g, '');
    setRecipientName(lettersOnly);
  };

  // Live Limit & Balance Validations (Transfer fee is deducted from the source wallet!)
  const numAmount = Number(amount) || 0;
  const numFee = Number(fee) || 0;
  const totalAmount = numAmount + numFee;

  let limitWarning: string | null = null;
  let balanceWarning: string | null = null;

  if (selectedLine && numAmount > 0 && operationMode === 'transfer') {
    if (totalAmount > selectedLine.balance) {
      balanceWarning = `الرصيد المتاح في الخط (${formatAmount(selectedLine.balance)} ج.م) غير كافٍ! المبلغ الإجمالي المطلوب خصمه شامل رسوم التحويل (${formatAmount(totalAmount)} ج.م) يتجاوز الرصيد الحالي.`;
    }
    const remainingDaily = selectedLine.remainingDaily ?? selectedLine.dailyLimit;
    if (totalAmount > remainingDaily) {
      limitWarning = `المبلغ المطلوب يتجاوز الحد اليومي المتبقي للخط (${formatAmount(remainingDaily)} ج.م)!`;
    }
    const remainingMonthly = selectedLine.remainingMonthly ?? selectedLine.monthlyLimit;
    if (totalAmount > remainingMonthly) {
      limitWarning = `المبلغ المطلوب يتجاوز الحد الشهري المتبقي للخط (${formatAmount(remainingMonthly)} ج.م)!`;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceLineId) {
      setErrorMessage(operationMode === 'receive' ? 'الرجاء اختيار الخط المستلم للمبلغ' : 'الرجاء اختيار الخط المرسل');
      return;
    }
    if (!recipientNumber.trim()) {
      setErrorMessage(operationMode === 'receive' ? 'الرجاء إدخال رقم هاتف الراسل أو المحفظة' : 'الرجاء إدخال رقم المستلم أو الحساب البنكي');
      return;
    }
    if (numAmount <= 0) {
      setErrorMessage('الرجاء إدخال مبلغ صالح أكبر من صفر');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Unique idempotency key to prevent double submissions
    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await api.createTransfer({
        transferType: operationMode === 'receive' ? 'receive_money' : transferType,
        sourceLineId,
        recipientType,
        recipientNumber: recipientNumber.trim(),
        recipientName: recipientName.trim() || (operationMode === 'receive' ? 'عميل مودع' : 'عميل'),
        destinationBankOrWallet,
        amount: numAmount,
        fee: numFee,
        notes: notes.trim(),
        idempotencyKey,
        overrideLimit,
      });

      setCreatedTransfer(res);
      onSuccess(res);
      loadLines(); // Refresh lines state and balances
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل تنفيذ العملية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNew = () => {
    setCreatedTransfer(null);
    setRecipientNumber('');
    setRecipientName('');
    setAmount('');
    setNotes('');
    setErrorMessage(null);
    if (operationMode === 'receive') {
      setFee('0');
    } else {
      setFee('10');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-emerald-500 selection:text-white" dir="rtl">
      
      {/* Top Banner & Operation Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              {operationMode === 'receive' ? 'استلام أموال وإيداع وارد' : 'تسجيل وإجراء تحويل جديد'}
            </h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
              operationMode === 'receive' 
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              {operationMode === 'receive' ? 'إيداع نقدي مباشر' : 'تحقق لحظي من الحدود'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {operationMode === 'receive' 
              ? 'استلام نقدية من عميل وإيداعها في رصيد المحفظة مع توليد إيصال استلام رسمي معتمد' 
              : 'تسجيل عمليات التحويل الفوري لمحفظة كاش، حساب بنكي، أو تحويل وموازنة بين الخطوط'}
          </p>
        </div>

        {/* Big Dual-Mode Switcher Buttons */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 w-full sm:w-auto shadow-inner">
          <button
            type="button"
            onClick={() => {
              setOperationMode('transfer');
              setCreatedTransfer(null);
              setErrorMessage(null);
            }}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition cursor-pointer leading-normal whitespace-nowrap ${
              operationMode === 'transfer'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 shrink-0" />
            <span>تحويل صادر (إرسال)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOperationMode('receive');
              setCreatedTransfer(null);
              setErrorMessage(null);
              setFee('0');
            }}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition cursor-pointer leading-normal whitespace-nowrap ${
              operationMode === 'receive'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 shrink-0" />
            <span>استلام أموال (وارد)</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner after Transfer OR Receive */}
      {createdTransfer && (
        <div className={`p-6 rounded-3xl shadow-2xl space-y-4 animate-fade-in border ${
          createdTransfer.transferType === 'receive_money'
            ? 'bg-blue-950/70 border-blue-500/50'
            : 'bg-emerald-950/70 border-emerald-500/50'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
                createdTransfer.transferType === 'receive_money'
                  ? 'bg-blue-500 text-slate-950'
                  : 'bg-emerald-500 text-slate-950'
              }`}>
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {createdTransfer.transferType === 'receive_money' 
                    ? 'تم استلام المبلغ بنجاح وتحديث رصيد الخط فورياً!' 
                    : 'تم تنفيذ وتسجيل التحويل بنجاح!'}
                </h3>
                <p className={`text-xs mt-0.5 font-mono ${
                  createdTransfer.transferType === 'receive_money' ? 'text-blue-200' : 'text-emerald-200'
                }`}>
                  الرقم المرجعي: <strong className="text-white">{createdTransfer.referenceNumber}</strong> · مرجع المزود: {createdTransfer.serviceProviderRef}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onPrintReceipt(createdTransfer)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-slate-950 hover:bg-slate-100 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
              >
                <Printer className={`w-4 h-4 ${createdTransfer.transferType === 'receive_money' ? 'text-blue-600' : 'text-emerald-600'}`} />
                <span>{createdTransfer.transferType === 'receive_money' ? 'طباعة إيصال الاستلام' : 'طباعة الإيصال الفوري'}</span>
              </button>

              <button
                type="button"
                onClick={handleStartNew}
                className={`flex-1 sm:flex-none px-4 py-2.5 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  createdTransfer.transferType === 'receive_money'
                    ? 'bg-blue-800 hover:bg-blue-700'
                    : 'bg-emerald-800 hover:bg-emerald-700'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>{createdTransfer.transferType === 'receive_money' ? 'استلام مبلغ آخر' : 'بدء عملية جديدة'}</span>
              </button>
            </div>
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs ${
            createdTransfer.transferType === 'receive_money'
              ? 'border-blue-500/30 text-blue-100'
              : 'border-emerald-500/30 text-emerald-100'
          }`}>
            <div>
              <span className="block opacity-80">
                {createdTransfer.transferType === 'receive_money' ? 'الخط المستلم للإيداع:' : 'الخط المرسل:'}
              </span>
              <strong className="text-white">{createdTransfer.sourceLineName}</strong>
            </div>
            <div>
              <span className="block opacity-80">
                {createdTransfer.transferType === 'receive_money' ? 'العميل الراسل / المودع:' : 'المستلم:'}
              </span>
              <strong className="text-white">{createdTransfer.recipientNumber}</strong> ({createdTransfer.recipientName})
            </div>
            <div>
              <span className="block opacity-80">
                {createdTransfer.transferType === 'receive_money' ? 'المبلغ المستلم:' : 'مبلغ التحويل:'}
              </span>
              <strong className="text-white font-mono text-sm">{formatAmount(createdTransfer.amount)} ج.م</strong>
            </div>
            <div>
              <span className="block opacity-80">
                {createdTransfer.transferType === 'receive_money' ? 'العمولة / الرسوم:' : 'العمولة المحصلة:'}
              </span>
              <strong className="text-white font-mono text-sm">{formatAmount(createdTransfer.fee)} ج.م</strong>
            </div>
          </div>
        </div>
      )}

      {/* Main Form & Financial Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Form Inputs (lg:col-span-8) */}
        <div className="lg:col-span-8 p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6">
          
          {errorMessage && !errorMessage.includes('تعذّر الاتصال') && !errorMessage.includes('Failed to fetch') && (
            <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/50 flex items-start gap-2.5 text-rose-200 text-xs animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Step 1: Mode specifics */}
            {operationMode === 'transfer' ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  1. نوع التحويل المالي:
                </label>
                {isSourceCashWallet(selectedLine?.provider) ? (
                  // عند التحويل من محفظة إلكترونية: إزالة بطاقتي تحويل بنكي مصرفي وتحويل بين خطوط الكاش طبقاً للطلب بدقة
                  <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">تحويل محفظة إلكترونية كاش</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                            محفظة كاش
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          إرسال كاش فوري ومباشر إلى محافظ العملاء (فودافون كاش · أورنج · اتصالات · وي)
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-500/40 shrink-0">
                      محفظة إلكترونية ✓
                    </span>
                  </div>
                ) : isSourceInstaPay(selectedLine?.provider) ? (
                  // عند التحويل من إنستاباي
                  <div className="p-4 rounded-2xl bg-violet-950/60 border border-violet-500 text-violet-300 shadow-md ring-1 ring-violet-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">تحويل عبر شبكة إنستاباي IPN</span>
                          <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-bold">
                            تحويل لحظي
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          إرسال لحظي إلى عناوين الدفع IPA والمحافظ الإلكترونية
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-violet-400 bg-violet-950 px-3 py-1.5 rounded-xl border border-violet-500/40 shrink-0">
                      إنستاباي IPN ✓
                    </span>
                  </div>
                ) : (
                  // عند التحويل من حساب بنكي
                  <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">تحويل بنكي مصرفي</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                            مصرفي / إنستاباي / محافظ
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          تحويل إلى الحسابات البنكية، IBAN، إنستاباي، وكافة المحافظ الإلكترونية
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-500/40 shrink-0">
                      تحويل بنكي ✓
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">إيداع واستلام نقدية واردة (Cash In)</h3>
                    <p className="text-[11px] text-slate-400">سيتم إضافة المبلغ المستلم مباشرة إلى رصيد الخط المختار وتحديث السيولة</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-blue-400 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-500/30">
                  إيداع مباشر (+)
                </span>
              </div>
            )}

            {/* Step 2: Line Selector (Source for send, Destination for receive) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                {operationMode === 'receive' 
                  ? 'الخط أو المحفظة المستلمة (التي يتم إيداع المبلغ بها):' 
                  : 'الخط أو المحفظة المرسلة (المصدر):'}
              </label>
              {isLoadingLines ? (
                <div className="p-4 bg-slate-950 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>جاري تحميل الخطوط المتاحة...</span>
                </div>
              ) : (
                <select
                  value={sourceLineId}
                  onChange={(e) => handleSourceLineChange(e.target.value)}
                  className="w-full p-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id} disabled={l.status !== 'active'}>
                      {l.name} ({l.phoneNumber}) - رصيد: {formatAmount(l.balance)} ج.م {operationMode === 'transfer' ? `- متبقي يومي: ${formatAmount(l.remainingDaily ?? l.dailyLimit)} ج.م` : ''} {l.status !== 'active' ? `(${l.status})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 3: Counterparty Information (Recipient or Sender) */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 block">
                  {operationMode === 'receive' ? 'بيانات العميل الراسل / المودع:' : 'بيانات الطرف والخط المستلم:'}
                </span>
                {operationMode === 'transfer' && isSourceCashWallet(selectedLine?.provider) && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    محافظ فقط (مخفي إنستاباي والبنوك)
                  </span>
                )}
              </div>

              {/* اختيار الخط المستلم عند التحويل (يظهر محافظ فقط عند التحويل من محفظة إلكترونية) */}
              {operationMode === 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    اختيار الخط أو المحفظة المستلمة:
                  </label>
                  <select
                    value={destinationLineChoice}
                    onChange={(e) => handleDestinationLineChoiceChange(e.target.value)}
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="manual">✏️ إدخال يدوي لرقم المحفظة / المستلم</option>
                    <optgroup label={isSourceCashWallet(selectedLine?.provider) ? "المحافظ الإلكترونية المسجلة (محافظ فقط)" : "الخطوط والمحافظ والحسابات المسجلة"}>
                      {allowedDestinationLines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.phoneNumber}) - {PROVIDER_CONFIG[l.provider]?.name || l.provider}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    {operationMode === 'receive' 
                      ? 'رقم هاتف الراسل أو محفظته *' 
                      : isSourceCashWallet(selectedLine?.provider)
                        ? 'رقم هاتف محفظة المستلم (01xxxxxxxxx) *'
                        : isSourceInstaPay(selectedLine?.provider)
                          ? 'عنوان الدفع اللحظي IPA أو رقم الهاتف أو الحساب *'
                          : 'رقم الحساب البنكي / IBAN / إنستاباي / رقم المحفظة *'}
                  </label>
                  <input
                    type="text"
                    value={recipientNumber}
                    onChange={(e) => handleRecipientNumberChange(e.target.value)}
                    required
                    inputMode={operationMode === 'receive' || isSourceCashWallet(selectedLine?.provider) ? 'numeric' : 'text'}
                    placeholder={
                      operationMode === 'receive' 
                        ? 'مثال: 01098765432 (أرقام إنجليزية فقط)' 
                        : isSourceCashWallet(selectedLine?.provider)
                          ? 'مثال: 01012345678 (أرقام إنجليزية فقط)'
                          : isSourceInstaPay(selectedLine?.provider)
                            ? 'مثال: username@instapay أو 01012345678'
                            : 'مثال: EG440003001889... أو 01012345678'
                    }
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    {operationMode === 'receive' ? 'اسم العميل الراسل (اختياري)' : 'اسم المستلم (اختياري)'}
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => handleRecipientNameChange(e.target.value)}
                    placeholder="مثال: أحمد عبد الله (حروف فقط بدون أرقام)"
                    className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  {operationMode === 'receive' 
                    ? 'وسيلة أو جهة الإيداع الوارد' 
                    : isSourceCashWallet(selectedLine?.provider)
                      ? 'شبكة المحفظة الإلكترونية المستقبلة للكاش'
                      : 'اسم البنك أو شبكة المحفظة المستقبلة'}
                </label>
                <select
                  value={destinationBankOrWallet}
                  onChange={(e) => setDestinationBankOrWallet(e.target.value)}
                  className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {operationMode === 'receive' ? (
                    <>
                      <option value="إنستاباي IPN (تحويل لحظي)">إنستاباي IPN (تحويل لحظي)</option>
                      <option value="فودافون كاش (Vodafone Cash)">فودافون كاش (Vodafone Cash)</option>
                      <option value="أورنج كاش (Orange Cash)">أورنج كاش (Orange Cash)</option>
                      <option value="اتصالات كاش (Etisalat Cash)">اتصالات كاش (Etisalat Cash)</option>
                      <option value="وي باي (WE Pay)">وي باي (WE Pay)</option>
                      <option value="إيداع كاش مباشر بالفرع">إيداع كاش مباشر بالفرع</option>
                      <option value="تحويل بنكي مصرفي">تحويل بنكي مصرفي</option>
                      <option value="شبكة فوري">شبكة فوري</option>
                      <option value="وسيلة أخرى">وسيلة أخرى</option>
                    </>
                  ) : isSourceCashWallet(selectedLine?.provider) ? (
                    // 1. تحويل محافظ إلكترونية: إزالة إنستاباي وجميع البنوك تماماً
                    <>
                      <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                      <option value="أورنج كاش">أورنج كاش (Orange Cash)</option>
                      <option value="اتصالات كاش">اتصالات كاش (Etisalat Cash)</option>
                      <option value="وي باي">وي باي (WE Pay)</option>
                      <option value="محفظة إلكترونية كاش أخرى">محفظة إلكترونية كاش أخرى</option>
                    </>
                  ) : isSourceInstaPay(selectedLine?.provider) ? (
                    // 2. تحويل إنستاباي: إظهار المحافظ الإلكترونية وإنستاباي
                    <>
                      <option value="شبكة إنستاباي IPN">شبكة إنستاباي IPN (المدفوعات اللحظية)</option>
                      <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                      <option value="أورنج كاش">أورنج كاش (Orange Cash)</option>
                      <option value="اتصالات كاش">اتصالات كاش (Etisalat Cash)</option>
                      <option value="وي باي">وي باي (WE Pay)</option>
                      <option value="محفظة إلكترونية أخرى">محفظة إلكترونية أخرى</option>
                    </>
                  ) : (
                    // 3. تحويل بنوك: الاستقبال لجميع المحافظ والكاش والبنوك وإنستاباي
                    <>
                      <optgroup label="البنوك المصرية (حسابات مصرفية)">
                        <option value="البنك الأهلي المصري">البنك الأهلي المصري (NBE)</option>
                        <option value="بنك مصر">بنك مصر (Banque Misr)</option>
                        <option value="البنك التجاري الدولي">البنك التجاري الدولي (CIB)</option>
                        <option value="بنك القاهرة">بنك القاهرة (Banque du Caire)</option>
                        <option value="بنك الإسكندرية">بنك الإسكندرية (Bank of Alexandria)</option>
                        <option value="بنك QNB الأهلي">بنك QNB الأهلي</option>
                        <option value="بنوك مصرية أخرى">بنوك مصرية أخرى</option>
                      </optgroup>
                      <optgroup label="شبكة المدفوعات اللحظية">
                        <option value="شبكة إنستاباي IPN">شبكة إنستاباي IPN (المدفوعات اللحظية)</option>
                      </optgroup>
                      <optgroup label="المحافظ الإلكترونية والكاش">
                        <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                        <option value="أورنج كاش">أورنج كاش (Orange Cash)</option>
                        <option value="اتصالات كاش">اتصالات كاش (Etisalat Cash)</option>
                        <option value="وي باي">وي باي (WE Pay)</option>
                        <option value="محفظة كاش أخرى">محفظة كاش أخرى</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Step 4: Amounts & Quick Chips */}
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
              <span className="text-xs font-bold text-slate-300 block">
                {operationMode === 'receive' ? 'المبلغ المستلم والعمولة:' : 'المبالغ المالية والعمولة:'}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    {operationMode === 'receive' ? 'المبلغ المستلم المراد إيداعه (ج.م) *' : 'مبلغ التحويل المراد إرساله (ج.م) *'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    required
                    placeholder="0"
                    className={`w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xl font-bold font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
                      operationMode === 'receive' 
                        ? 'text-blue-400 focus:ring-blue-500' 
                        : 'text-emerald-400 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-400">
                      {operationMode === 'receive' ? 'عمولة أو رسوم الاستلام (ج.م)' : 'رسوم التحويل (ج.م)'}
                    </label>
                    {operationMode === 'transfer' && (
                      <span className="text-[10px] text-amber-400 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                        تُخصم من المحفظة المصدر
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="0"
                    className="w-full p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xl font-bold font-mono text-amber-400 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Quick Amount Add Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap pt-1.5">
                <span className="text-[11px] text-slate-400 font-semibold">إضافة سريعة:</span>
                {[500, 1000, 2000, 5000, 10000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddQuickAmount(preset)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition border border-slate-700/80 cursor-pointer shadow-sm active:scale-95 leading-normal"
                  >
                    +{formatAmount(preset)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">ملاحظات العملية (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="أي ملاحظات تخص العملية أو رقم سند خارجي..."
                className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Warnings (for transfer only) */}
            {operationMode === 'transfer' && (balanceWarning || limitWarning) && (
              <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/50 space-y-2 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه الحدود المالية والسيولة:</span>
                </div>
                {balanceWarning && <p>{balanceWarning}</p>}
                {limitWarning && <p>{limitWarning}</p>}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 text-white font-black rounded-2xl text-base shadow-xl flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                operationMode === 'receive'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-blue-600/30'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-600/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري تسجيل وتنفيذ العملية...</span>
                </>
              ) : operationMode === 'receive' ? (
                <>
                  <ArrowDownLeft className="w-5 h-5" />
                  <span>تأكيد استلام المبلغ وإيداعه في المحفظة ({formatAmount(numAmount)} ج.م)</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>تنفيذ التحويل المالي فورياً ({formatAmount(numAmount)} ج.م)</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Live Calculation Sidebar (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Selected Line Card */}
          {selectedLine ? (
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-400">
                  {operationMode === 'receive' ? 'الخط المستلم' : 'الخط المصدر'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                  نشط ومعتمد
                </span>
              </div>

              <ProviderBadge provider={selectedLine.provider} size="lg" />

              <div>
                <h4 className="font-extrabold text-white text-base">{selectedLine.name}</h4>
                <p className="text-xs font-mono text-cyan-400 mt-0.5">{selectedLine.phoneNumber}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">المالك: {selectedLine.accountHolder}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">الرصيد الحالي:</span>
                  <span className="font-bold font-mono text-white text-sm">{formatAmount(selectedLine.balance)} ج.م</span>
                </div>

                {operationMode === 'receive' ? (
                  <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-blue-400 font-bold">الرصيد بعد الإيداع:</span>
                    <span className="font-black font-mono text-blue-300 text-sm">
                      {formatAmount(selectedLine.balance + numAmount)} ج.م
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">المتبقي اليوم:</span>
                      <span className="font-mono text-emerald-400">
                        {formatAmount(selectedLine.remainingDaily ?? selectedLine.dailyLimit)} ج.م
                      </span>
                    </div>
                    <div className="flex justify-between text-xs pt-2 border-t border-slate-800">
                      <span className="text-slate-300 font-bold">الرصيد المتوقع بعد التحويل والرسوم:</span>
                      <span className="font-black font-mono text-white text-sm">
                        {formatAmount(Math.max(0, selectedLine.balance - totalAmount))} ج.م
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 text-center text-slate-400 text-xs">
              الرجاء اختيار خط كاش لعرض تفاصيل الرصيد
            </div>
          )}

          {/* Operation Summary Breakdown Card */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>ملخص العملية المالية</span>
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">نوع العملية:</span>
                <span className={`font-bold ${operationMode === 'receive' ? 'text-blue-400' : 'text-emerald-400'}`}>
                  {operationMode === 'receive' ? 'استلام أموال (إيداع وارد)' : 'تحويل صادر'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ الأساسي:</span>
                <span className="font-mono font-bold text-white">{formatAmount(numAmount)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">الرسوم / العمولة:</span>
                <span className="font-mono font-bold text-amber-400">{formatAmount(numFee)} ج.م</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 font-bold text-sm">
                <span className="text-white">الإجمالي:</span>
                <span className="font-mono font-black text-white">{formatAmount(totalAmount)} ج.م</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>يتم توليد إيصال فوري معتمد قابل للطباعة بمجرد تأكيد المعاملة</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
